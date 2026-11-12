/*  PostShot studio: ties the page, the data API and the renderer together. */
(function () {
  "use strict";
  var R = window.PostShotRender;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var sampleSet = window.PostShotSamples.build(function (w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; return c; });

  var BACKDROPS = [
    { id: "match", label: "Match the post", cfg: { type: "match" } },
    { id: "ink", label: "Ink", cfg: { type: "solid", c1: "#0b0b0c" } },
    { id: "paper", label: "Paper", cfg: { type: "solid", c1: "#ece6da" } },
    { id: "slate", label: "Slate", cfg: { type: "solid", c1: "#2a3038" } },
    { id: "dusk", label: "Dusk", cfg: { type: "gradient", c1: "#1f2a44", c2: "#8a5a9c", angle: 135 } },
    { id: "ember", label: "Ember", cfg: { type: "gradient", c1: "#3a1c1c", c2: "#d98a5f", angle: 150 } }
  ];

  var S = {
    model: null, source: null, id: null, urlHandle: "", assets: {}, hadParents: false,
    theme: "light", layout: "detail", metrics: true, views: true, showDate: true, showTime: true, actions: true, sourceApp: false, parents: false,
    ratio: "", pad: "0", backdrop: "match", custom: "#3b3b46",
    format: "png", scale: "3", busy: false, lastBlob: null
  };
  try { var saved = JSON.parse(localStorage.getItem("postshot.prefs") || "{}"); ["theme", "format", "scale"].forEach(function (k) { if (saved[k]) S[k] = saved[k]; }); } catch (e) {}
  function savePrefs() { try { localStorage.setItem("postshot.prefs", JSON.stringify({ theme: S.theme, format: S.format, scale: S.scale })); } catch (e) {} }

  /* ---------------- small UI helpers ---------------- */
  function setState(s) { document.body.setAttribute("data-state", s); }
  function toast(msg, link) {
    var t = $("#toast"); t.textContent = msg;
    if (link) { var a = document.createElement("a"); a.href = link.href; a.target = "_blank"; a.rel = "noopener"; a.textContent = link.text; t.appendChild(a); }
    t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, link ? 9000 : 4200);
  }
  function showError(msg) { var e = $("#error"); e.textContent = msg || ""; e.hidden = !msg; }
  function loading(btn, on) { btn.classList.toggle("is-loading", on); btn.disabled = on; }
  function seg(id, value, onPick) {
    var g = $(id);
    g.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b || b.getAttribute("aria-disabled") === "true") return;
      onPick(b.getAttribute("data-v"));
    });
    return function (v) { $$(id + " button").forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-v") === String(v))); }); };
  }

  /* ---------------- link reading ---------------- */
  function parseLink(text) {
    var s = String(text || "").trim();
    if (/^\d{5,25}$/.test(s)) return { id: s, handle: "" };
    var m = /status(?:es)?\/(\d{5,25})/i.exec(s);
    if (!m) return null;
    var h = /(?:^|\/\/|\.)(?:x|twitter|fxtwitter|fixupx|vxtwitter|fixvx)\.com\/(\w{1,15})\/status/i.exec(s) || /\/(\w{1,15})\/status(?:es)?\/\d/i.exec(s);
    return { id: m[1], handle: h ? h[1] : "" };
  }

  /* ---------------- pictures ---------------- */
  var imgCache = {};
  function loadImg(url, cors) {
    return new Promise(function (resolve) {
      var im = new Image();
      if (cors) im.crossOrigin = "anonymous";
      im.onload = function () { resolve(im); };
      im.onerror = function () { resolve(null); };
      im.src = url;
    });
  }
  function loader(url) {
    if (sampleSet.art[url]) return Promise.resolve(sampleSet.art[url]);
    if (imgCache[url]) return imgCache[url];
    var p;
    if (url.indexOf("cdn.jsdelivr.net") > -1) {
      p = loadImg(url, true).then(function (im) { return im || loadImg("/api/img?u=" + encodeURIComponent(url), false); });
    } else p = loadImg(url, false);
    imgCache[url] = p;
    return p;
  }
  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(["400", "500", "600", "700"].map(function (w) { return document.fonts.load(w + " 15px Inter"); })).catch(function () {});
  }

  /* ---------------- rendering ---------------- */
  var cv = $("#cv"), raf = 0;
  function opts() {
    var b = BACKDROPS.filter(function (x) { return x.id === S.backdrop; })[0];
    var bd = S.backdrop === "custom" ? { type: "solid", c1: S.custom } : (b ? b.cfg : { type: "match" });
    return {
      theme: S.theme, layout: S.layout, showMetrics: S.metrics, showViews: S.views, showDate: S.showDate, showTime: S.showTime, showActions: S.actions, showSource: S.sourceApp,
      now: Date.now(), frame: { pad: +S.pad, ratio: S.ratio ? +S.ratio : null, backdrop: bd }
    };
  }
  function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
  var lastInfo = null;
  function draw() {
    if (!S.model) return;
    var dpr = window.devicePixelRatio || 1;
    var prev = Math.min(3, Math.max(2, Math.ceil(dpr)));
    lastInfo = R.render(cv, S.model, opts(), S.assets, prev);
    fit();
    updateLabels();
  }
  function fit() {
    if (!lastInfo) return;
    var wrap = $("#canvas-wrap"), avail = wrap.clientWidth || 360;
    var maxH = Math.max(420, window.innerHeight * (window.innerWidth >= 960 ? 0.82 : 1.2));
    var cap = window.innerWidth >= 960 ? 1.6 : 1;
    var k = Math.min(cap, avail / lastInfo.w, maxH / lastInfo.h);
    cv.style.width = Math.round(lastInfo.w * k) + "px";
    cv.style.height = Math.round(lastInfo.h * k) + "px";
  }
  window.addEventListener("resize", fit);

  function outputScale(info) {
    var req = +S.scale, max = Math.min(req, Math.sqrt(16000000 / (info.w * info.h)), 8192 / Math.max(info.w, info.h));
    return Math.max(1, Math.floor(max * 100) / 100);
  }
  function updateLabels() {
    if (!lastInfo) return;
    var sc = outputScale(lastInfo);
    var pw = Math.round(lastInfo.w * sc), ph = Math.round(lastInfo.h * sc);
    $("#dims").textContent = pw + " × " + ph + " px";
    $("#file-hint").textContent = sc < +S.scale ? "Reduced to " + (Math.round(sc * 10) / 10) + "× so this tall image works on your device." : "Exports at " + pw + " × " + ph + " pixels.";
    $("#btn-download .label").textContent = "Download " + (S.format === "jpeg" ? "JPG" : "PNG");
    var forced = R.usedLayout(S.model, { layout: S.layout }) === "timeline" && S.layout === "detail";
    var h = $("#layout-hint");
    h.hidden = !forced;
    h.textContent = forced ? (S.model.repostBy ? "Reposts use the timeline view, as X does." : "Conversations use the timeline view, as X does.") : "";
    pickLayout(forced ? "timeline" : S.layout);
    $$("#seg-layout button[data-v=detail]").forEach(function (b) { b.setAttribute("aria-disabled", String(forced)); });
  }

  function syncControls() {
    pickTheme(S.theme); pickLayout(S.layout); pickRatio(S.ratio); pickPad(S.pad); pickFormat(S.format); pickScale(S.scale);
    $("#opt-metrics").checked = S.metrics; $("#opt-views").checked = S.views; $("#opt-date").checked = S.showDate; $("#opt-time").checked = S.showTime; $("#opt-actions").checked = S.actions; $("#opt-source").checked = S.sourceApp; $("#opt-parents").checked = S.parents;
    $$("#swatches .sw-dot").forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-v") === S.backdrop)); });
  }

  /* ---------------- controls ---------------- */
  var pickTheme = seg("#seg-theme", S.theme, function (v) { S.theme = v; savePrefs(); pickTheme(v); schedule(); });
  var pickLayout = seg("#seg-layout", S.layout, function (v) { S.layout = v; pickLayout(v); schedule(); });
  var pickRatio = seg("#seg-ratio", S.ratio, function (v) { S.ratio = v; pickRatio(v); schedule(); });
  var pickPad = seg("#seg-pad", S.pad, function (v) { S.pad = v; pickPad(v); schedule(); });
  var pickFormat = seg("#seg-format", S.format, function (v) { S.format = v; savePrefs(); pickFormat(v); schedule(); });
  var pickScale = seg("#seg-scale", S.scale, function (v) { S.scale = v; savePrefs(); pickScale(v); schedule(); });
  [["#opt-metrics", "metrics"], ["#opt-views", "views"], ["#opt-date", "showDate"], ["#opt-time", "showTime"], ["#opt-actions", "actions"], ["#opt-source", "sourceApp"]].forEach(function (p) {
    $(p[0]).addEventListener("change", function (e) { S[p[1]] = e.target.checked; schedule(); });
  });
  $("#opt-parents").addEventListener("change", function (e) { S.parents = e.target.checked; load({ id: S.id, handle: S.urlHandle, parents: S.parents, keepRepost: true, quiet: true }); });

  (function buildSwatches() {
    var box = $("#swatches");
    BACKDROPS.forEach(function (b) {
      var el = document.createElement("button");
      el.type = "button"; el.setAttribute("role", "radio"); el.setAttribute("aria-label", b.label); el.title = b.label;
      el.className = "sw-dot" + (b.id === "match" ? " match" : ""); el.setAttribute("data-v", b.id);
      if (b.cfg.type === "solid") el.style.setProperty("--c", b.cfg.c1);
      if (b.cfg.type === "gradient") el.style.setProperty("--c", "linear-gradient(135deg," + b.cfg.c1 + "," + b.cfg.c2 + ")");
      el.style.background = b.cfg.type === "solid" ? b.cfg.c1 : b.cfg.type === "gradient" ? "linear-gradient(135deg," + b.cfg.c1 + "," + b.cfg.c2 + ")" : "";
      el.addEventListener("click", function () { pickBackdrop(b.id); });
      box.appendChild(el);
    });
    var c = document.createElement("div");
    c.className = "sw-dot custom"; c.setAttribute("role", "radio"); c.setAttribute("aria-label", "Custom colour"); c.setAttribute("data-v", "custom"); c.innerHTML = "+";
    var inp = document.createElement("input"); inp.type = "color"; inp.value = S.custom; inp.setAttribute("aria-label", "Pick a custom backdrop colour");
    inp.addEventListener("input", function () { S.custom = inp.value; c.style.background = inp.value; c.innerHTML = ""; c.appendChild(inp); pickBackdrop("custom"); });
    c.appendChild(inp); box.appendChild(c);
  })();
  function pickBackdrop(id) {
    S.backdrop = id;
    $$("#swatches .sw-dot").forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-v") === id)); });
    if (id !== "match" && S.pad === "0" && !S.ratio) { S.pad = "48"; pickPad("48"); }
    schedule();
  }

  /* ---------------- repost panel ---------------- */
  function renderRepostPanel() {
    var box = $("#repost-state"), rb = S.model && S.model.repostBy;
    box.innerHTML = "";
    $("#form-repost").hidden = S.source === "sample" || !!rb;
    if (rb) {
      var d = document.createElement("div"); d.className = "repost-card";
      var how = rb.detected === "user" ? "Added by you" : rb.detected === "sample" ? "Sample" : "Found in the post’s data";
      var t = document.createElement("div"); t.innerHTML = "<strong></strong><small></small>";
      t.firstChild.textContent = rb.name + " reposted"; t.lastChild.textContent = how;
      d.appendChild(t);
      if (S.source !== "sample") {
        var b = document.createElement("button"); b.type = "button"; b.textContent = "Remove";
        b.addEventListener("click", function () { S.model.repostBy = null; renderRepostPanel(); renderNotices(); schedule(); });
        d.appendChild(b);
      }
      box.appendChild(d);
    }
    $("#box-repost").open = !!rb;
    $("#box-repost").hidden = S.source === "sample" && !rb;
  }
  $("#form-repost").addEventListener("submit", function (e) {
    e.preventDefault();
    var h = $("#reposter").value.trim().replace(/^@/, "");
    if (!/^\w{1,15}$/.test(h)) { toast("Enter an X username, like @name"); return; }
    addReposter(h);
  });
  function addReposter(h) {
    var btn = $("#form-repost button"); btn.disabled = true;
    fetch("/api/tweet?profile=" + encodeURIComponent(h)).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) throw new Error(x.j.error || "Couldn’t find that account.");
        S.model.repostBy = { name: x.j.profile.name, handle: x.j.profile.handle, detected: "user" };
        S.model.thread = []; S.parents = false; $("#opt-parents").checked = false;
        $("#reposter").value = ""; renderRepostPanel(); renderNotices(); prepareAndDraw(); toast("Repost line added");
      }).catch(function (err) { toast(err.message); }).then(function () { btn.disabled = false; });
  }

  /* ---------------- notices ---------------- */
  function renderNotices() {
    var box = $("#notices"); box.innerHTML = "";
    if (!S.model) return;
    (S.model.warnings || []).forEach(function (w) { var n = document.createElement("div"); n.className = "notice"; n.textContent = w; box.appendChild(n); });
    var hint = S.model.hint;
    if (hint && !S.model.repostBy) {
      var n = document.createElement("div"); n.className = "notice";
      n.innerHTML = "<span></span><div class='acts'><button class='go' type='button'></button><button type='button'>Not a repost</button></div>";
      n.firstChild.textContent = "This link names @" + hint.handle + ", but the post is by @" + S.model.post.author.handle + ". If @" + hint.handle + " reposted it, you can show it as a repost.";
      var btns = n.querySelectorAll("button"); btns[0].textContent = "Show as repost by @" + hint.handle;
      btns[0].addEventListener("click", function () { addReposter(hint.handle); });
      btns[1].addEventListener("click", function () { S.model.hint = null; renderNotices(); });
      box.appendChild(n);
    }
  }

  /* ---------------- loading a post ---------------- */
  function prepareAndDraw() {
    return R.prepare(S.model, loader).then(function (a) { S.assets = a; $("#canvas-wrap").classList.remove("busy"); $("#skeleton").hidden = true; draw(); });
  }
  function enterStudio(pillText, sample) {
    setState("studio"); $("#studio").hidden = false; $("#btn-new").hidden = false;
    var p = $("#pill"); p.textContent = pillText; p.className = "pill" + (sample ? " sample" : "");
    var parents = !!(S.model.parentAvailable) && S.source !== "sample";
    $("#row-parents").hidden = !parents; $("#row-source").hidden = false;
    $("#opt-parents").checked = S.parents;
    syncControls(); renderRepostPanel(); renderNotices();
  }
  function pillFor() {
    if (S.source === "sample") return "Sample post · made up, not a real post";
    var m = S.model, base = "Imported · @" + m.post.author.handle;
    if (m.repostBy) base += m.repostBy.detected === "user" ? " · repost line added by you" : " · repost detected";
    return base;
  }

  function load(o) {
    if (S.busy) return Promise.resolve();
    S.busy = true;
    var goBtn = $("#btn-go");
    var inStudio = document.body.getAttribute("data-state") === "studio" && S.model;
    if (inStudio) $("#canvas-wrap").classList.add("busy"); else loading(goBtn, true);
    showError("");
    var qs = "id=" + encodeURIComponent(o.id) + (o.handle ? "&handle=" + encodeURIComponent(o.handle) : "") + (o.parents ? "&parents=2" : "");
    var keepRepost = o.keepRepost && S.model ? S.model.repostBy : null;
    return Promise.all([fetch("/api/tweet?" + qs).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }), loadFonts()])
      .then(function (res) {
        var x = res[0];
        if (!x.ok) throw new Error(x.j && x.j.error || "Something went wrong.");
        var j = x.j;
        S.source = "import"; S.id = o.id; S.urlHandle = o.handle || "";
        S.parents = !!o.parents;
        S.model = { post: j.post, repostBy: j.repostBy || keepRepost, thread: j.thread || [], hint: j.hint, warnings: j.warnings || [], parentAvailable: j.parentAvailable };
        if (S.model.thread.length || S.model.repostBy) { /* renderer switches to timeline by itself */ }
        return R.prepare(S.model, loader);
      }).then(function (assets) {
        S.assets = assets;
        enterStudio(pillFor(), false);
        $("#canvas-wrap").classList.remove("busy");
        draw();
        if (!o.quiet) window.scrollTo({ top: 0, behavior: "smooth" });
      }).catch(function (err) {
        $("#canvas-wrap").classList.remove("busy");
        var msg = err && err.message === "Failed to fetch" ? "You appear to be offline. Check your connection and try again." : (err && err.message) || "Something went wrong.";
        if (inStudio) toast(msg); else showError(msg);
        if (inStudio) { $("#opt-parents").checked = S.parents = false; }
      }).then(function () { S.busy = false; loading(goBtn, false); });
  }

  function loadSample(id) {
    var s = sampleSet.samples.filter(function (x) { return x.id === id; })[0]; if (!s) return;
    showError("");
    loadFonts().then(function () {
      S.source = "sample"; S.id = null; S.parents = false;
      var m = s.model;
      S.model = { post: m.post, repostBy: m.repostBy || null, thread: [], hint: null, warnings: [], parentAvailable: false };
      return R.prepare(S.model, loader);
    }).then(function (a) { S.assets = a; enterStudio(pillFor(), true); draw(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  }

  /* ---------------- export ---------------- */
  function renderBlob() {
    var c = document.createElement("canvas");
    var info = R.render(c, S.model, opts(), S.assets, 1);
    var sc = outputScale(info);
    info = R.render(c, S.model, opts(), S.assets, sc);
    var mime = S.format === "jpeg" ? "image/jpeg" : "image/png";
    return new Promise(function (resolve, reject) {
      c.toBlob(function (b) { b ? resolve({ blob: b, w: c.width, h: c.height, scale: sc }) : reject(new Error("The image couldn’t be created on this device. Try a lower quality setting.")); }, mime, 0.95);
    });
  }
  function fileName() {
    var p = S.model.post, h = (p.author.handle || "post").replace(/\W/g, "");
    return "postshot-" + h + (p.id ? "-" + p.id : "") + (S.format === "jpeg" ? ".jpg" : ".png");
  }
  function exportNow(share) {
    if (!S.model) return;
    var btn = $("#btn-download"); loading(btn, true);
    loadFonts().then(renderBlob).then(function (r) {
      var name = fileName(), url = URL.createObjectURL(r.blob);
      if (S.lastBlob) URL.revokeObjectURL(S.lastBlob);
      S.lastBlob = url;
      if (share) {
        var file = new File([r.blob], name, { type: r.blob.type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file] }).catch(function (e) { if (e && e.name !== "AbortError") throw e; });
        share = false;
      }
      var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      toast("Saved " + r.w + " × " + r.h + " " + (S.format === "jpeg" ? "JPG" : "PNG"), { href: url, text: "Open" });
    }).catch(function (err) { toast(err.message || "Couldn’t create the image."); }).then(function () { loading(btn, false); });
  }
  $("#btn-download").addEventListener("click", function () { exportNow(false); });
  $("#btn-share").addEventListener("click", function () { exportNow(true); });
  try { var tf = new File([""], "t.png", { type: "image/png" }); if (navigator.canShare && navigator.canShare({ files: [tf] })) $("#btn-share").hidden = false; } catch (e) {}

  /* ---------------- paste form ---------------- */
  $("#form").addEventListener("submit", function (e) {
    e.preventDefault();
    var p = parseLink($("#url").value);
    if (!p) { showError("That doesn’t look like a link to an X post. It should end in /status/ and a long number."); return; }
    load({ id: p.id, handle: p.handle, parents: false });
  });
  if (navigator.clipboard && navigator.clipboard.readText) {
    $("#btn-paste").hidden = false;
    $("#btn-paste").addEventListener("click", function () {
      navigator.clipboard.readText().then(function (t) {
        $("#url").value = t.trim();
        if (parseLink(t)) $("#form").requestSubmit ? $("#form").requestSubmit() : $("#btn-go").click();
        else showError("The clipboard doesn’t contain an X post link.");
      }).catch(function () { $("#url").focus(); toast("Paste is blocked here. Press and hold in the box to paste."); });
    });
  }
  $("#btn-new").addEventListener("click", function () {
    S.model = null; S.assets = {}; S.id = null; S.parents = false; lastInfo = null;
    $("#url").value = ""; $("#studio").hidden = true; $("#btn-new").hidden = true; $("#notices").innerHTML = ""; showError("");
    setState("empty"); window.scrollTo({ top: 0, behavior: "smooth" }); $("#url").focus();
  });

  /* ---------------- samples ---------------- */
  sampleSet.samples.forEach(function (s) {
    var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = s.label;
    b.addEventListener("click", function () { loadSample(s.id); });
    $("#samples").appendChild(b);
  });

  /* link opened with ?url=... or ?sample=... */
  (function boot() {
    var q = new URLSearchParams(location.search);
    if (q.get("sample")) loadSample(q.get("sample"));
    else if (q.get("url")) { $("#url").value = q.get("url"); var p = parseLink(q.get("url")); if (p) load({ id: p.id, handle: p.handle }); }
    loadFonts();
  })();
  window.__postshot = { S: S, draw: draw, renderBlob: renderBlob };
})();
