/*  PostShot renderer
 *  Draws an X post the way the X iPhone app shows it, onto a <canvas>.
 *  The preview on screen and the exported file use this exact same code,
 *  so what you see is what you download. Works at any resolution (vector text).
 *
 *  Public API (global `PostShotRender`):
 *    prepare(model, loader)          -> Promise<assets>   (loads pictures + emoji)
 *    render(canvas, model, opts, assets, scale) -> {w,h}
 *    THEMES, FONT_STACK
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PostShotRender = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Constants                                                           */
  /* ------------------------------------------------------------------ */
  var W = 393; // iPhone 15 Pro screen width in points
  var FONT_STACK = '"Inter", -apple-system, "SF Pro Text", "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif';
  var EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  var EMOJI_CDN = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/";
  var HAIR = 0.67; // thin line weight, about 2 real pixels at 3x

  var THEMES = {
    light: { bg: "#ffffff", text: "#0f1419", sub: "#536471", divider: "#eff3f4", border: "#cfd9de", thread: "#cfd9de", blue: "#1d9bf0", media: "#e7ecef", pill: "rgba(15,20,25,.75)" },
    dim:   { bg: "#15202b", text: "#f7f9f9", sub: "#8b98a5", divider: "#38444d", border: "#38444d", thread: "#38444d", blue: "#1d9bf0", media: "#22303c", pill: "rgba(0,0,0,.7)" },
    dark:  { bg: "#000000", text: "#e7e9ea", sub: "#71767b", divider: "#2f3336", border: "#2f3336", thread: "#333639", blue: "#1d9bf0", media: "#16181c", pill: "rgba(0,0,0,.7)" }
  };
  var BADGE = { blue: "#1d9bf0", gold: "#e2b719", gray: "#829aab" };

  // Icon outlines (24 x 24 grid)
  var PATHS = {
    reply: "M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z",
    repost: "M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z",
    like: "M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z",
    views: "M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z",
    bookmark: "M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z",
    share: "M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z",
    logo: "M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.9-6.4L6.3 22H3.1l7.3-8.4L2.7 2h6.4l4.4 5.9L18.9 2zm-1.1 18h1.7L8 3.9H6.2L17.8 20z",
    more: "M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z",
    badge: "M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"
  };
  var pathCache = {};
  function path2d(name) {
    if (!pathCache[name]) pathCache[name] = new Path2D(PATHS[name]);
    return pathCache[name];
  }

  /* ------------------------------------------------------------------ */
  /* Text helpers                                                        */
  /* ------------------------------------------------------------------ */
  var SEG = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
  function graphemes(s) {
    if (SEG) { var out = []; var it = SEG.segment(s); for (var x of it) out.push(x.segment); return out; }
    return Array.from(s);
  }
  var RE_EMOJI_ANY = /\p{Extended_Pictographic}/u;
  var RE_EMOJI_PRES = /^\p{Emoji_Presentation}/u;
  var RE_FLAG = /^\p{Regional_Indicator}{2}$/u;
  var RE_KEYCAP = /^[0-9#*]\uFE0F?\u20E3$/;
  function isEmoji(g) {
    if (g.length === 1 && !RE_EMOJI_PRES.test(g)) return false;
    if (RE_FLAG.test(g) || RE_KEYCAP.test(g)) return true;
    if (RE_EMOJI_PRES.test(g)) return true;
    return RE_EMOJI_ANY.test(g) && /[\uFE0F\u200D]/.test(g);
  }
  function emojiUrl(g) {
    var cps = Array.from(g).map(function (c) { return c.codePointAt(0).toString(16); });
    if (g.indexOf("\u200d") < 0) cps = cps.filter(function (c) { return c !== "fe0f"; });
    return EMOJI_CDN + cps.join("-") + ".png";
  }

  var RE_TOKEN = /https?:\/\/[^\s]+|www\.[^\s]+|@\w{1,15}|#[\p{L}\p{N}_]+|\$[A-Za-z][A-Za-z0-9]{0,5}\b/gu;
  function shortUrl(u) {
    var d = u.replace(/^https?:\/\/(www\.)?/i, "");
    return d.length > 23 ? d.slice(0, 23) + "\u2026" : d;
  }
  // Split one paragraph into plain and "link-coloured" pieces
  function toSpans(text) {
    var out = [], last = 0, m;
    RE_TOKEN.lastIndex = 0;
    while ((m = RE_TOKEN.exec(text))) {
      var s = m[0], i = m.index, c = s.charAt(0), prev = i > 0 ? text.charAt(i - 1) : "";
      var isUrl = c === "h" || c === "w";
      if (!isUrl && /[\w@#$]/.test(prev)) continue;
      if (c === "#" && !/\p{L}/u.test(s)) continue;
      if (isUrl) { while (/[.,;:!?)\]'"\u201d\u2019]$/.test(s)) s = s.slice(0, -1); }
      if (i > last) out.push({ t: text.slice(last, i) });
      out.push({ t: s, link: true, display: isUrl ? shortUrl(s) : s });
      last = i + s.length;
      RE_TOKEN.lastIndex = last;
    }
    if (last < text.length) out.push({ t: text.slice(last) });
    return out;
  }

  function Painter(ctx, theme, assets, draw) {
    this.ctx = ctx; this.T = theme; this.assets = assets || {}; this.draw = draw;
  }
  var P = Painter.prototype;
  P.font = function (size, weight) { this.ctx.font = (weight || 400) + " " + size + "px " + FONT_STACK; };
  P.measure = function (s, size, weight) { this.font(size, weight); return this.ctx.measureText(s).width; };
  P.emojiAdv = function (size) { return size * 1.3; };

  // Break a string into drawable pieces (text runs and emoji)
  P.pieces = function (str, size, weight, link) {
    var out = [], run = "", self = this;
    function flush() { if (run) { out.push({ s: run, w: self.measure(run, size, weight), link: link }); run = ""; } }
    graphemes(str).forEach(function (g) {
      if (isEmoji(g)) { flush(); out.push({ s: g, emoji: true, w: self.emojiAdv(size), link: link }); }
      else run += g;
    });
    flush();
    return out;
  };
  P.drawPieces = function (items, x, baseline, size, weight, color, linkColor) {
    if (!this.draw) return;
    var ctx = this.ctx;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.emoji) {
        var img = this.assets[emojiUrl(it.s)];
        if (img) {
          var sz = size * 1.18;
          ctx.drawImage(img, x + size * 0.06, baseline + size * 0.2 - sz, sz, sz);
        } else {
          ctx.font = size + "px " + EMOJI_FONT; ctx.fillStyle = color;
          ctx.fillText(it.s, x, baseline);
        }
      } else if (it.s !== " " || it.link) {
        this.font(size, weight);
        ctx.fillStyle = it.link ? linkColor : color;
        ctx.fillText(it.s, x, baseline);
      }
      x += it.w;
    }
  };
  // One line of text, shortened with an ellipsis if it is too wide
  P.line = function (str, size, weight, maxW) {
    var items = this.pieces(str, size, weight), w = sum(items);
    if (maxW != null && w > maxW) {
      var gs = graphemes(str);
      while (gs.length > 1) {
        gs.pop();
        items = this.pieces(gs.join("").replace(/\s+$/, "") + "\u2026", size, weight);
        w = sum(items);
        if (w <= maxW) break;
      }
    }
    return { items: items, w: w };
  };
  function sum(items) { var t = 0; items.forEach(function (i) { t += i.w; }); return t; }

  // Wrap a block of post text. Returns lines of drawable pieces.
  P.wrap = function (text, size, maxW) {
    var self = this, lines = [];
    var paras = String(text || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").split("\n");
    var spaceW = this.measure(" ", size, 400);
    paras.forEach(function (para) {
      if (para.trim() === "") { lines.push({ items: [], w: 0 }); return; }
      var words = [], cur = null;
      function pushCur() { if (cur) { words.push(cur); cur = null; } }
      toSpans(para).forEach(function (sp) {
        if (sp.display != null) {
          cur = cur || { items: [], w: 0 };
          self.pieces(sp.display, size, 400, true).forEach(function (p) { cur.items.push(p); cur.w += p.w; });
          return;
        }
        sp.t.split(/(\s+)/).forEach(function (part) {
          if (part === "") return;
          if (/^\s+$/.test(part)) { pushCur(); words.push({ space: true }); return; }
          cur = cur || { items: [], w: 0 };
          self.pieces(part, size, 400, false).forEach(function (p) { cur.items.push(p); cur.w += p.w; });
        });
      });
      pushCur();
      var line = { items: [], w: 0 }, space = false;
      function newLine() { lines.push(line); line = { items: [], w: 0 }; space = false; }
      words.forEach(function (wd) {
        if (wd.space) { space = line.items.length > 0; return; }
        if (wd.w > maxW) { // a single word wider than the line: break it
          if (line.items.length) newLine();
          wd.items.forEach(function (it) {
            var parts = it.emoji ? [it] : graphemes(it.s).map(function (g) { return { s: g, w: self.measure(g, size, 400), link: it.link }; });
            parts.forEach(function (p) {
              if (line.w + p.w > maxW && line.items.length) newLine();
              line.items.push(p); line.w += p.w;
            });
          });
          return;
        }
        var need = (space && line.items.length ? spaceW : 0) + wd.w;
        if (line.w + need > maxW + 0.01 && line.items.length) { newLine(); need = wd.w; space = false; }
        if (space && line.items.length) { line.items.push({ s: " ", w: spaceW }); line.w += spaceW; }
        wd.items.forEach(function (p) { line.items.push(p); });
        line.w += wd.w; space = false;
      });
      lines.push(line);
    });
    return lines;
  };
  P.drawLines = function (lines, x, y, lh, size, color, linkColor) {
    if (!this.draw) return;
    for (var i = 0; i < lines.length; i++) {
      var base = y + i * lh + lh / 2 + size * 0.35;
      this.drawPieces(lines[i].items, x, base, size, 400, color, linkColor);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Shape helpers                                                       */
  /* ------------------------------------------------------------------ */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function imgSize(img) { return [img.naturalWidth || img.width, img.naturalHeight || img.height]; }
  function cover(ctx, img, x, y, w, h) {
    var s = imgSize(img), iw = s[0], ih = s[1];
    if (!iw || !ih) return;
    var k = Math.max(w / iw, h / ih), sw = w / k, sh = h / k;
    ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
  }
  P.icon = function (name, x, y, size, color) {
    if (!this.draw) return;
    var ctx = this.ctx;
    ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24);
    ctx.fillStyle = color; ctx.fill(path2d(name));
    ctx.restore();
  };
  P.badge = function (kind, x, cy, size) {
    if (!this.draw) return;
    var ctx = this.ctx, y = cy - size / 2;
    if (kind === "gold") { // organisations get a rounded square
      ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24);
      ctx.fillStyle = BADGE.gold; rr(ctx, 2, 2, 20, 20, 6.5); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.1; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(7.4, 12.2); ctx.lineTo(10.6, 15.3); ctx.lineTo(16.6, 8.9); ctx.stroke();
      ctx.restore();
    } else this.icon("badge", x, y, size, BADGE[kind] || BADGE.blue);
  };
  P.hline = function (x1, x2, y, color) {
    if (!this.draw) return;
    this.ctx.fillStyle = color; this.ctx.fillRect(x1, y - HAIR / 2, x2 - x1, HAIR);
  };
  P.avatar = function (author, x, y, d) {
    if (!this.draw) return;
    var ctx = this.ctx, img = author.avatar && this.assets[author.avatar];
    ctx.save();
    ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    if (img) { ctx.imageSmoothingQuality = "high"; cover(ctx, img, x, y, d, d); }
    else { // neutral placeholder with initial
      ctx.fillStyle = this.T.media; ctx.fillRect(x, y, d, d);
      var ch = (author.name || author.handle || "?").trim().charAt(0).toUpperCase();
      ctx.fillStyle = this.T.sub; this.font(d * 0.42, 600); ctx.textAlign = "center";
      ctx.fillText(ch, x + d / 2, y + d / 2 + d * 0.15); ctx.textAlign = "left";
    }
    ctx.restore();
    ctx.save(); ctx.strokeStyle = this.T.divider; ctx.lineWidth = HAIR;
    ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d / 2 - HAIR / 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  };

  /* ------------------------------------------------------------------ */
  /* Numbers and dates                                                   */
  /* ------------------------------------------------------------------ */
  function fmtCount(n) {
    if (n == null || isNaN(n) || n <= 0) return "";
    if (n < 10000) return Number(n).toLocaleString("en-US");
    var v;
    if (n < 1e6) { v = n / 1e3; return (v < 100 ? Math.floor(v * 10) / 10 : Math.floor(v)) + "K"; }
    v = n / 1e6; return (v < 100 ? Math.floor(v * 10) / 10 : Math.floor(v)) + "M";
  }
  function fmtDetailDate(iso, tz, showTime, showDate) {
    var d = new Date(iso); if (isNaN(d)) return "";
    var o = tz ? { timeZone: tz } : {}, parts = [];
    if (showTime) parts.push(new Intl.DateTimeFormat("en-US", Object.assign({ hour: "numeric", minute: "2-digit" }, o)).format(d).replace(/\u202f/g, " "));
    if (showDate) parts.push(new Intl.DateTimeFormat("en-US", Object.assign({ month: "short", day: "numeric", year: "numeric" }, o)).format(d));
    return parts.join(" · ");
  }
  function fmtShortAge(iso, now, tz) {
    var d = new Date(iso); if (isNaN(d)) return "";
    var s = Math.max(0, ((now || Date.now()) - d.getTime()) / 1000);
    if (s < 60) return Math.floor(s) + "s";
    if (s < 3600) return Math.floor(s / 60) + "m";
    if (s < 86400) return Math.floor(s / 3600) + "h";
    var o = tz ? { timeZone: tz } : {};
    var nowY = new Intl.DateTimeFormat("en-US", Object.assign({ year: "numeric" }, o)).format(new Date(now || Date.now()));
    var y = new Intl.DateTimeFormat("en-US", Object.assign({ year: "numeric" }, o)).format(d);
    var f = nowY === y ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" };
    return new Intl.DateTimeFormat("en-US", Object.assign(f, o)).format(d);
  }
  function fmtDuration(ms) {
    if (!ms) return "";
    var s = Math.round(ms / 1000), m = Math.floor(s / 60);
    return m + ":" + String(s % 60).padStart(2, "0");
  }

  /* ------------------------------------------------------------------ */
  /* Media                                                               */
  /* ------------------------------------------------------------------ */
  function mediaHeight(media, w) {
    if (!media || !media.length) return 0;
    if (media.length === 1) {
      var m = media[0], r = m.width && m.height ? m.width / m.height : 16 / 9;
      r = Math.max(0.4, Math.min(3, r));
      return Math.round(w / r);
    }
    return Math.round(w * 9 / 16);
  }
  function mediaCells(n, w, h, g) {
    var hw = (w - g) / 2, hh = (h - g) / 2;
    if (n === 2) return [[0, 0, hw, h], [hw + g, 0, hw, h]];
    if (n === 3) return [[0, 0, hw, h], [hw + g, 0, hw, hh], [hw + g, hh + g, hw, hh]];
    return [[0, 0, hw, hh], [hw + g, 0, hw, hh], [0, hh + g, hw, hh], [hw + g, hh + g, hw, hh]];
  }
  // Draws a block of pictures. radius = corner radius (0 when inside a quote card).
  P.media = function (media, x, y, w, radius, border) {
    var h = mediaHeight(media, w);
    if (!this.draw || !h) return h;
    var ctx = this.ctx, T = this.T, list = media.slice(0, 4), self = this;
    ctx.save();
    rr(ctx, x, y, w, h, radius); ctx.clip();
    ctx.fillStyle = T.media; ctx.fillRect(x, y, w, h);
    ctx.imageSmoothingQuality = "high";
    var cells = list.length === 1 ? [[0, 0, w, h]] : mediaCells(list.length, w, h, 2);
    list.forEach(function (m, i) {
      var c = cells[i], img = m.src && self.assets[m.src];
      if (img) cover(ctx, img, x + c[0], y + c[1], c[2], c[3]);
      if (m.type === "video" || m.type === "gif") self.mediaBadge(m, x + c[0], y + c[1], c[2], c[3], list.length === 1);
    });
    ctx.restore();
    if (border) {
      ctx.save(); ctx.strokeStyle = T.divider; ctx.lineWidth = HAIR;
      rr(ctx, x + HAIR / 2, y + HAIR / 2, w - HAIR, h - HAIR, radius); ctx.stroke(); ctx.restore();
    }
    return h;
  };
  P.mediaBadge = function (m, x, y, w, h, big) {
    var ctx = this.ctx, T = this.T;
    if (m.type === "video") {
      var d = big ? 64 : 44, cx = x + w / 2, cy = y + h / 2;
      ctx.fillStyle = "rgba(15,20,25,.62)"; ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, d / 2 - 0.75, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.beginPath();
      var k = d / 64;
      ctx.moveTo(cx - 8 * k, cy - 12 * k); ctx.lineTo(cx + 13 * k, cy); ctx.lineTo(cx - 8 * k, cy + 12 * k); ctx.closePath(); ctx.fill();
    }
    var label = m.type === "gif" ? "GIF" : fmtDuration(m.duration);
    if (label) {
      this.font(13, 600);
      var tw = ctx.measureText(label).width, bw = tw + 14, bh = 22, bx = x + 8, by = y + h - bh - 8;
      ctx.fillStyle = T.pill; rr(ctx, bx, by, bw, bh, 5); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(label, bx + 7, by + bh / 2 + 4.6);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Quote card                                                          */
  /* ------------------------------------------------------------------ */
  P.quote = function (q, x, y, w, o) {
    var T = this.T, ctx = this.ctx, pad = 12, inner = w - pad * 2;
    var cy = y + pad, h;
    if (q.unavailable) {
      var lh = 20; h = pad * 2 + lh;
      if (this.draw) {
        ctx.save(); ctx.strokeStyle = T.border; ctx.lineWidth = HAIR; rr(ctx, x + HAIR / 2, y + HAIR / 2, w - HAIR, h - HAIR, 16); ctx.stroke(); ctx.restore();
        this.font(15, 400); ctx.fillStyle = T.sub; ctx.fillText("This post is unavailable.", x + pad, y + pad + lh / 2 + 5.2);
      }
      return h;
    }
    // header
    var d = 20, hx = x + pad;
    var age = o.quoteTime && q.createdAt ? fmtShortAge(q.createdAt, o.now, o.timeZone) : "";
    var timeW = age ? this.measure(" \u00b7 " + age, 15, 400) : 0;
    var avail = inner - d - 8 - timeW;
    var nm = this.line(q.author.name || q.author.handle, 15, 700, avail * 0.62 - (q.author.verified ? 19 : 0));
    var bw = q.author.verified ? 19 : 0;
    var hd = this.line("@" + q.author.handle, 15, 400, Math.max(20, avail - nm.w - bw - 4));
    if (this.draw) {
      this.avatar(q.author, hx, cy, d);
      var tx = hx + d + 8, base = cy + 10 + 5.25;
      this.drawPieces(nm.items, tx, base, 15, 700, T.text, T.blue);
      tx += nm.w;
      if (q.author.verified) { this.badge(q.author.verified, tx + 2, cy + 10, 16); tx += bw; }
      tx += 4;
      this.drawPieces(hd.items, tx, base, 15, 400, T.sub, T.blue);
      tx += hd.w;
      if (age) { this.font(15, 400); ctx.fillStyle = T.sub; ctx.fillText(" \u00b7 " + age, tx, base); }
    }
    cy += 20 + 2;
    var hasText = q.text && q.text.trim();
    var lines = hasText ? this.wrap(q.text, 15, inner) : [];
    if (lines.length) { this.drawLines(lines, hx, cy, 20, 15, T.text, T.blue); cy += lines.length * 20; }
    var mh = 0;
    if (q.media && q.media.length) {
      cy += lines.length ? 10 : 6;
      mh = mediaHeight(q.media, w);
      cy += mh; h = cy - y;
    } else { cy += pad - (lines.length ? 0 : 0); h = cy - y; }
    if (this.draw) {
      ctx.save();
      rr(ctx, x, y, w, h, 16); ctx.clip();
      if (mh) this.media(q.media, x, y + h - mh, w, 0, false);
      ctx.restore();
      ctx.save(); ctx.strokeStyle = T.border; ctx.lineWidth = HAIR;
      rr(ctx, x + HAIR / 2, y + HAIR / 2, w - HAIR, h - HAIR, 16); ctx.stroke(); ctx.restore();
    }
    return h;
  };

  /* ------------------------------------------------------------------ */
  /* Action icons                                                        */
  /* ------------------------------------------------------------------ */
  P.metricRow = function (p, o, x, y, w, h) {
    var T = this.T, m = p.metrics || {}, cyc = y + h / 2;
    var showN = o.showMetrics !== false;
    var slots = [
      ["reply", showN ? fmtCount(m.replies) : ""],
      ["repost", showN ? fmtCount(m.reposts) : ""],
      ["like", showN ? fmtCount(m.likes) : ""],
      ["views", o.showViews !== false && showN ? fmtCount(m.views) : ""]
    ];
    var sw = (w - 56) / 4;
    for (var i = 0; i < 4; i++) {
      var sx = x + i * sw;
      this.icon(slots[i][0], sx - 2, cyc - 10, 20, T.sub);
      if (slots[i][1] && this.draw) { this.font(13, 400); this.ctx.fillStyle = T.sub; this.ctx.fillText(slots[i][1], sx + 22, cyc + 4.6); }
    }
    this.icon("bookmark", x + w - 52, cyc - 10, 20, T.sub);
    this.icon("share", x + w - 20, cyc - 10, 20, T.sub);
  };

  /* ------------------------------------------------------------------ */
  /* The two layouts                                                     */
  /* ------------------------------------------------------------------ */
  // Detail layout: what you see after opening a post.
  P.detail = function (p, o, y0) {
    var T = this.T, ctx = this.ctx, y = y0 + 14, px = 16, cw = W - px * 2;
    var d = 40, tx = px + d + 10;
    var bw = p.author.verified ? 20 : 0;
    var nm = this.line(p.author.name || p.author.handle, 15, 700, W - tx - px - 28 - bw);
    var hd = this.line("@" + p.author.handle, 15, 400, W - tx - px - 28);
    if (this.draw) {
      this.avatar(p.author, px, y, d);
      this.drawPieces(nm.items, tx, y + 10 + 5.25, 15, 700, T.text, T.blue);
      if (p.author.verified) this.badge(p.author.verified, tx + nm.w + 3, y + 10, 17);
      this.drawPieces(hd.items, tx, y + 30 + 5.25, 15, 400, T.sub, T.blue);
      this.icon("logo", W - px - 22, y + d / 2 - 11, 22, T.text);
    }
    y += d + 12;
    if (p.replyingTo) { this.replyingTo(p.replyingTo, px, y); y += 28; }
    var lines = this.wrap(p.text, 16, cw), lh = 22;
    if (lines.length && (p.text || "").trim()) { this.drawLines(lines, px, y, lh, 16, T.text, T.blue); y += lines.length * lh; y += 10; }
    if (p.media && p.media.length) { y += this.media(p.media, px, y, cw, 16, true) + 12; }
    if (p.quote) { y += this.quote(p.quote, px, y, cw, o) + 12; }
    // time and views
    var date = fmtDetailDate(p.createdAt, o.timeZone, o.showTime !== false, o.showDate !== false);
    var views = o.showViews !== false ? fmtCount(p.metrics && p.metrics.views) : "";
    var src = o.showSource && p.source ? p.source : "";
    if (date || views || src) {
      y += 2;
      if (this.draw) {
        var base = y + 10 + 5.25, x = px;
        this.font(15, 400); ctx.fillStyle = T.sub; ctx.fillText(date, x, base); x += ctx.measureText(date).width;
        if (views) {
          var dot = " \u00b7 "; ctx.fillText(dot, x, base); x += ctx.measureText(dot).width;
          this.font(15, 700); ctx.fillStyle = T.text; ctx.fillText(views, x, base); x += ctx.measureText(views).width;
          this.font(15, 400); ctx.fillStyle = T.sub; ctx.fillText(" Views", x, base); x += ctx.measureText(" Views").width;
        }
        if (src) { this.font(15, 400); ctx.fillStyle = T.sub; ctx.fillText(" \u00b7 " + src, x, base); }
      }
      y += 20 + 12;
    } else y += 4;
    var m = p.metrics || {};
    if (o.showMetrics !== false) {
      var stats = [["reposts", "Repost", "Reposts"], ["quotes", "Quote", "Quotes"], ["likes", "Like", "Likes"], ["bookmarks", "Bookmark", "Bookmarks"]].filter(function (s) { return m[s[0]] > 0; });
      if (stats.length) {
        this.hline(px, W - px, y, T.divider);
        if (this.draw) {
          var bx = px, bb = y + 24 + 5.25;
          for (var i = 0; i < stats.length; i++) {
            var n = fmtCount(m[stats[i][0]]), lab = " " + (m[stats[i][0]] === 1 ? stats[i][1] : stats[i][2]);
            this.font(15, 700); ctx.fillStyle = T.text; ctx.fillText(n, bx, bb); bx += ctx.measureText(n).width;
            this.font(15, 400); ctx.fillStyle = T.sub; ctx.fillText(lab, bx, bb); bx += ctx.measureText(lab).width + 20;
          }
        }
        y += 48;
      }
    }
    if (o.showActions !== false) {
      this.hline(px, W - px, y, T.divider);
      var names = ["reply", "repost", "like", "bookmark", "share"], gap = (cw - 22) / 4;
      for (var k = 0; k < 5; k++) this.icon(names[k], px + k * gap, y + 23 - 11, 22, T.sub);
      y += 46;
    }
    this.hline(0, W, y, T.divider);
    return y - y0 + 1;
  };

  P.replyingTo = function (handle, x, y) {
    if (!this.draw) return;
    var ctx = this.ctx, base = y + 10 + 5.25;
    this.font(15, 400); ctx.fillStyle = this.T.sub;
    var lab = "Replying to ";
    ctx.fillText(lab, x, base);
    ctx.fillStyle = this.T.blue; ctx.fillText("@" + handle, x + ctx.measureText(lab).width, base);
  };

  // Timeline layout: what you see scrolling the feed. Used for reposts and threads.
  P.timeline = function (p, o, y0, flags) {
    flags = flags || {};
    var T = this.T, ctx = this.ctx, px = 16, d = 40, x0 = px + d + 12, cw = W - px - x0;
    var y = y0 + 12;
    if (flags.repostBy) {
      var rb = this.line(flags.repostBy.name + " reposted", 13, 700, cw);
      if (this.draw) {
        this.icon("repost", x0 - 12 - 16 - 0, y + 1, 16, T.sub);
        this.drawPieces(rb.items, x0, y + 8 + 4.55, 13, 700, T.sub, T.sub);
      }
      y += 20 + 4;
    }
    var top = y;
    // name row
    var age = p.createdAt && (o.showDate !== false || o.showTime !== false) ? fmtShortAge(p.createdAt, o.now, o.timeZone) : "";
    var timeStr = age ? " \u00b7 " + age : "";
    var timeW = this.measure(timeStr, 15, 400);
    var bw = p.author.verified ? 20 : 0, avail = cw - 24 - timeW;
    var nm = this.line(p.author.name || p.author.handle, 15, 700, Math.max(60, avail * 0.6 - bw));
    var hd = this.line("@" + p.author.handle, 15, 400, Math.max(30, avail - nm.w - bw - 4));
    if (this.draw) {
      var base = y + 10 + 5.25, x = x0;
      this.drawPieces(nm.items, x, base, 15, 700, T.text, T.blue); x += nm.w;
      if (p.author.verified) { this.badge(p.author.verified, x + 2, y + 10, 17); x += bw; }
      x += 4;
      this.drawPieces(hd.items, x, base, 15, 400, T.sub, T.blue); x += hd.w;
      if (timeStr) { this.font(15, 400); ctx.fillStyle = T.sub; ctx.fillText(timeStr, x, base); }
      this.icon("logo", W - px - 18, y + 10 - 9, 18, T.text);
    }
    y += 20;
    if (p.replyingTo) { y += 2; if (this.draw) { this.font(15, 400); ctx.fillStyle = T.sub; var lab = "Replying to "; ctx.fillText(lab, x0, y + 10 + 5.25); ctx.fillStyle = T.blue; ctx.fillText("@" + p.replyingTo, x0 + ctx.measureText(lab).width, y + 10 + 5.25); } y += 22; }
    var lines = this.wrap(p.text, 15, cw);
    if (lines.length && (p.text || "").trim()) { this.drawLines(lines, x0, y, 20, 15, T.text, T.blue); y += lines.length * 20; }
    if (p.media && p.media.length) { y += 10; y += this.media(p.media, x0, y, cw, 16, true); }
    if (p.quote) { y += 10; y += this.quote(p.quote, x0, y, cw, o); }
    y += 4;
    if (o.showActions !== false) { this.metricRow(p, o, x0, y, cw, 40); y += 40; } else y += 8;
    y += 4;
    if (this.draw) {
      var ax = px + d / 2;
      if (flags.connectBottom) { ctx.fillStyle = T.thread; ctx.fillRect(ax - 1, top + d + 4, 2, y - (top + d + 4)); }
      if (flags.connectTop) { ctx.fillStyle = T.thread; ctx.fillRect(ax - 1, y0, 2, top - y0 - 4); }
      this.avatar(p.author, px, top, d);
    }
    if (flags.divider !== false) this.hline(0, W, y, T.divider);
    return y - y0 + (flags.divider !== false ? 1 : 0);
  };

  /* ------------------------------------------------------------------ */
  /* Whole post                                                          */
  /* ------------------------------------------------------------------ */
  // model = { post, repostBy: {name}|null, thread: [parent posts, oldest first] }
  function usedLayout(model, opts) {
    if (model.repostBy || (model.thread && model.thread.length)) return "timeline";
    return opts.layout === "timeline" ? "timeline" : "detail";
  }
  function paintPost(ctx, model, opts, assets, draw, ox, oy) {
    var T = THEMES[opts.theme] || THEMES.light;
    var pt = new Painter(ctx, T, assets, draw);
    if (draw) { ctx.save(); ctx.translate(ox || 0, oy || 0); ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; }
    var h = 0, lay = usedLayout(model, opts);
    if (lay === "detail") h = pt.detail(model.post, opts, 0);
    else {
      var parents = model.thread || [];
      parents.forEach(function (pp) { h += pt.timeline(pp, opts, h, { connectBottom: true, divider: false }); });
      h += pt.timeline(model.post, opts, h, { repostBy: model.repostBy, connectTop: parents.length > 0 });
    }
    if (draw) ctx.restore();
    return { w: W, h: h, layout: lay };
  }

  /* ------------------------------------------------------------------ */
  /* Frame (optional padding / backdrop / aspect ratio)                  */
  /* ------------------------------------------------------------------ */
  function frameGeometry(inner, f) {
    f = f || {};
    var pad = f.pad || 0, bw = inner.w + pad * 2, bh = inner.h + pad * 2, cw = bw, ch = bh;
    if (f.ratio) {
      if (bw / bh < f.ratio) cw = Math.round(bh * f.ratio); else ch = Math.round(bw / f.ratio);
    }
    return { cw: cw, ch: ch, x: Math.round((cw - inner.w) / 2), y: Math.round((ch - inner.h) / 2), framed: pad > 0 || !!f.ratio };
  }
  function paintBackdrop(ctx, T, f, cw, ch) {
    var b = f.backdrop || { type: "match" };
    if (b.type === "gradient") {
      var a = ((b.angle == null ? 135 : b.angle) - 90) * Math.PI / 180, cx = cw / 2, cy = ch / 2, r = Math.abs(cw * Math.cos(a)) / 2 + Math.abs(ch * Math.sin(a)) / 2;
      var g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.addColorStop(0, b.c1 || "#222"); g.addColorStop(1, b.c2 || "#000"); ctx.fillStyle = g;
    } else ctx.fillStyle = b.type === "solid" ? b.c1 : T.bg;
    ctx.fillRect(0, 0, cw, ch);
  }
  function measureModel(canvas, model, opts, assets) {
    var ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return paintPost(ctx, model, opts, assets, false);
  }
  function render(canvas, model, opts, assets, scale) {
    scale = scale || 2;
    var inner = measureModel(canvas, model, opts, assets);
    var f = opts.frame || {}, g = frameGeometry(inner, f);
    canvas.width = Math.round(g.cw * scale); canvas.height = Math.round(g.ch * scale);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    var T = THEMES[opts.theme] || THEMES.light;
    paintBackdrop(ctx, T, f, g.cw, g.ch);
    var styled = g.framed && f.backdrop && f.backdrop.type !== "match" && f.backdrop.type != null;
    if (styled) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.38)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
      ctx.fillStyle = T.bg; rr(ctx, g.x, g.y, inner.w, inner.h, 22); ctx.fill();
      ctx.restore();
      ctx.save(); rr(ctx, g.x, g.y, inner.w, inner.h, 22); ctx.clip();
      paintPost(ctx, model, opts, assets, true, g.x, g.y);
      ctx.restore();
    } else {
      ctx.fillStyle = T.bg; ctx.fillRect(g.x, g.y, inner.w, inner.h);
      paintPost(ctx, model, opts, assets, true, g.x, g.y);
    }
    return { w: g.cw, h: g.ch, innerW: inner.w, innerH: inner.h, layout: inner.layout };
  }

  /* ------------------------------------------------------------------ */
  /* Loading pictures and emoji                                          */
  /* ------------------------------------------------------------------ */
  function allPosts(model) {
    var list = [model.post].concat(model.thread || []);
    list.slice().forEach(function (p) { if (p && p.quote) list.push(p.quote); });
    return list.filter(Boolean);
  }
  function allStrings(model) {
    var out = [];
    allPosts(model).forEach(function (p) { out.push(p.text || "", p.author && p.author.name || ""); });
    if (model.repostBy) out.push(model.repostBy.name || "");
    return out;
  }
  function prepare(model, loader) {
    var urls = {};
    allPosts(model).forEach(function (p) {
      if (p.author && p.author.avatar) urls[p.author.avatar] = 1;
      (p.media || []).forEach(function (m) { if (m.src) urls[m.src] = 1; });
    });
    allStrings(model).forEach(function (s) {
      graphemes(s).forEach(function (g) { if (isEmoji(g)) urls[emojiUrl(g)] = 1; });
    });
    var assets = {};
    return Promise.all(Object.keys(urls).map(function (u) {
      return Promise.resolve(loader(u)).then(function (img) { if (img) assets[u] = img; }, function () {});
    })).then(function () { return assets; });
  }

  return { render: render, prepare: prepare, THEMES: THEMES, FONT_STACK: FONT_STACK, usedLayout: usedLayout, W: W, _fmtCount: fmtCount, _isEmoji: isEmoji, _emojiUrl: emojiUrl };
});
