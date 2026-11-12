// PostShot: fetches a public X post and returns clean JSON for the front end.
//
//   GET /api/tweet?id=123                 -> the post
//   GET /api/tweet?id=123&parents=2       -> the post plus up to 3 posts it replied to
//   GET /api/tweet?id=123&handle=name     -> same, and flags a possible repost when the link's @name differs from the author
//   GET /api/tweet?profile=name           -> basic public profile (used when you say "reposted by @name")
//
// Two public sources are used and merged (same two as the first version of PostShot):
//   1. api.fxtwitter.com            -> engagement numbers, long posts, quotes, media sizes
//   2. cdn.syndication.twimg.com    -> verification, replies, parents, fallback when the first is down
// Nothing here needs a key. Nothing is invented: a missing field comes back as null.

const FX = (process.env.FX_BASE || "https://api.fxtwitter.com").replace(/\/$/, "");
const SYN = (process.env.SYNDICATION_BASE || "https://cdn.syndication.twimg.com").replace(/\/$/, "");
const UA = "Mozilla/5.0 (compatible; PostShot/2.0; +https://postshot-phi.vercel.app)";
const TIMEOUT_MS = 6000;

/* ---------- small helpers ---------- */
const tok = id => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
const proxy = u => (u ? "/api/img?u=" + encodeURIComponent(u) : null);
const decode = s => String(s || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, "&");
const isNum = n => typeof n === "number" && isFinite(n);
const num = n => (isNum(n) ? n : null);
const bigAvatar = u => (u ? String(u).replace(/_(normal|bigger|mini|200x200)(\.\w+)$/, "_400x400$2") : null);
const photoUrl = u => {
  if (!u) return null;
  if (!/pbs\.twimg\.com\/media\//.test(u)) return u;
  return /[?&]name=/.test(u) ? u.replace(/([?&]name=)\w+/, "$1large") : u + (u.includes("?") ? "&" : "?") + "name=large";
};
const stripTags = s => decode(String(s || "").replace(/<[^>]*>/g, "")).trim() || null;

async function getJson(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: ctl.signal });
    let body = null;
    try { body = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error("HTTP " + r.status); err.status = r.status; err.body = body; throw err; }
    return body;
  } finally { clearTimeout(timer); }
}

/* ---------- raw fetchers ---------- */
async function rawFx(id) {
  const j = await getJson(`${FX}/status/${id}`);
  if (!j || !j.tweet) throw Object.assign(new Error("no data"), { status: 404 });
  return j.tweet;
}
async function rawSyn(id) {
  const j = await getJson(`${SYN}/tweet-result?id=${id}&lang=en&token=${tok(id)}`);
  if (!j || !j.user || j.__typename === "TweetTombstone") throw Object.assign(new Error("no data"), { status: 404 });
  return j;
}

/* ---------- verification badges ---------- */
function verifiedFx(a) {
  if (!a) return null;
  const v = a.verification;
  if (v && typeof v === "object") {
    const t = String(v.type || "").toLowerCase();
    if (t === "government") return "gray";
    if (t === "organization" || t === "business") return "gold";
    if (v.verified || t === "individual") return "blue";
  }
  const vt = String(a.verified_type || "").toLowerCase();
  if (vt === "government") return "gray";
  if (vt === "business") return "gold";
  if (a.is_blue_verified || a.verified === true) return "blue";
  return null;
}
function verifiedSyn(u) {
  if (!u) return null;
  const vt = String(u.verified_type || "").toLowerCase();
  if (vt === "government") return "gray";
  if (vt === "business") return "gold";
  if (u.is_blue_verified || u.verified === true) return "blue";
  return null;
}

/* ---------- normalisers: both sources -> one shape ---------- */
function isoFromFx(t) {
  if (isNum(t.created_timestamp)) return new Date(t.created_timestamp * 1000).toISOString();
  const d = new Date(t.created_at); return isNaN(d) ? null : d.toISOString();
}

function fromFx(t, depth) {
  if (!t || !t.author) return null;
  const a = t.author;
  const all = (t.media && (t.media.all || [].concat(t.media.photos || [], t.media.videos || []))) || [];
  const media = all.map(m => {
    const type = m.type === "photo" ? "photo" : m.type === "gif" ? "gif" : "video";
    const src = type === "photo" ? photoUrl(m.url) : (m.thumbnail_url || null);
    return { type, src: proxy(src), width: num(m.width), height: num(m.height), duration: isNum(m.duration) ? Math.round(m.duration * 1000) : null };
  }).filter(m => m.src || m.type !== "photo");
  const rt = t.reposted_by || t.retweeted_by || null;
  const quote = t.quote && !depth ? fromFx(t.quote, 1) : null;
  return {
    id: String(t.id || ""),
    text: t.text || "",
    createdAt: isoFromFx(t),
    author: { name: a.name || a.screen_name, handle: a.screen_name, avatar: proxy(bigAvatar(a.avatar_url)), verified: verifiedFx(a) },
    media,
    quote,
    replyingTo: typeof t.replying_to === "string" ? t.replying_to : (t.replying_to && t.replying_to.screen_name) || null,
    replyToId: t.replying_to_status || null,
    source: stripTags(t.source),
    metrics: { replies: num(t.replies), reposts: num(t.retweets), likes: num(t.likes), views: num(t.views), bookmarks: num(t.bookmarks), quotes: num(t.quotes) },
    _repostedBy: rt && typeof rt === "object" ? { name: rt.name || rt.screen_name, handle: rt.screen_name || rt.handle } : null,
    _retweetedObj: t.retweeted_status || t.retweeted_tweet || t.retweet || null
  };
}

function fromSyn(t, depth) {
  if (!t || !t.user) return null;
  const u = t.user;
  let text = decode(t.text || "");
  // hide the automatic "@name " prefix that X puts in front of replies
  let prefix = "";
  const rng = t.display_text_range;
  if (t.in_reply_to_screen_name && Array.isArray(rng) && rng[0] > 0) {
    const chars = Array.from(text);
    prefix = chars.slice(0, rng[0]).join("");
    text = chars.slice(rng[0]).join("");
  }
  const ent = t.entities || {};
  (ent.media || []).forEach(m => { text = text.split(m.url).join(""); });
  (ent.urls || []).forEach(x => {
    const isQuoteLink = t.quoted_tweet && /\/status\/\d+/.test(x.expanded_url || "");
    text = text.split(x.url).join(isQuoteLink ? "" : (x.expanded_url || x.display_url || x.url));
  });
  const md = t.mediaDetails || [];
  const media = md.map(m => {
    const type = m.type === "photo" ? "photo" : m.type === "animated_gif" ? "gif" : "video";
    const oi = m.original_info || {};
    return { type, src: proxy(type === "photo" ? photoUrl(m.media_url_https) : m.media_url_https), width: num(oi.width), height: num(oi.height),
      duration: m.video_info && isNum(m.video_info.duration_millis) ? m.video_info.duration_millis : null };
  });
  const quote = t.quoted_tweet && !depth ? fromSyn(t.quoted_tweet, 1) : null;
  return {
    id: String(t.id_str || ""),
    text: text.trim(),
    createdAt: t.created_at && !isNaN(new Date(t.created_at)) ? new Date(t.created_at).toISOString() : null,
    author: { name: u.name || u.screen_name, handle: u.screen_name, avatar: proxy(bigAvatar(u.profile_image_url_https)), verified: verifiedSyn(u) },
    media,
    quote,
    replyingTo: t.in_reply_to_screen_name || null,
    replyToId: t.in_reply_to_status_id_str || null,
    source: null,
    metrics: { replies: null, reposts: null, likes: num(t.favorite_count), views: null, bookmarks: null, quotes: null },
    _prefix: prefix,
    _parent: t.parent ? fromSyn(t.parent, 1) : null,
    _quotedId: t.quoted_status_id_str || null,
    _isQuote: !!(t.is_quote_status || t.quoted_status_id_str),
    _retweetedObj: t.retweeted_status || null,
    _conversationCount: num(t.conversation_count)
  };
}

function mergeMedia(a, b) {
  if (!a.length) return b;
  return a.map((m, i) => {
    const o = b[i] || {};
    return Object.assign({}, m, { width: m.width || o.width || null, height: m.height || o.height || null, duration: m.duration || o.duration || null, src: m.src || o.src || null });
  });
}
function merge(a, b) {
  if (!a) return b; if (!b) return a;
  const o = Object.assign({}, b, a);
  o.author = Object.assign({}, b.author, a.author);
  o.author.verified = a.author.verified || b.author.verified || null;
  o.author.avatar = a.author.avatar || b.author.avatar;
  o.text = a.text || b.text;
  if (b._prefix && o.text.startsWith(b._prefix)) o.text = o.text.slice(b._prefix.length);
  o.createdAt = a.createdAt || b.createdAt;
  o.replyingTo = a.replyingTo || b.replyingTo;
  o.replyToId = a.replyToId || b.replyToId;
  o.media = mergeMedia(a.media || [], b.media || []);
  o.quote = a.quote || b.quote;
  o.metrics = {};
  ["replies", "reposts", "likes", "views", "bookmarks", "quotes"].forEach(k => { o.metrics[k] = a.metrics[k] != null ? a.metrics[k] : b.metrics[k]; });
  o._parent = b._parent || null;
  o._quotedId = b._quotedId || null;
  o._isQuote = !!(a.quote || b.quote || b._isQuote);
  o._repostedBy = a._repostedBy || b._repostedBy || null;
  o._retweetedObj = a._retweetedObj || b._retweetedObj || null;
  o._conversationCount = b._conversationCount;
  return o;
}
function tidyText(p) {
  let t = p.text || "";
  if (p.media && p.media.length) t = t.replace(/\s*https?:\/\/t\.co\/\w+\s*$/, "");
  if (p.quote || p._isQuote) t = t.replace(/\s*https?:\/\/(?:x|twitter)\.com\/\w+\/status\/\d+\S*\s*$/i, "");
  p.text = t.trim();
  return p;
}
function clean(p) {
  if (!p) return p;
  const o = Object.assign({}, p);
  Object.keys(o).forEach(k => { if (k.charAt(0) === "_") delete o[k]; });
  if (o.quote) o.quote = clean(o.quote);
  return o;
}

/* ---------- resolving a post (both sources, merged) ---------- */
async function resolve(id) {
  const [fx, syn] = await Promise.allSettled([rawFx(id), rawSyn(id)]);
  const A = fx.status === "fulfilled" ? fx.value : null;
  const B = syn.status === "fulfilled" ? syn.value : null;
  if (!A && !B) {
    const e = fx.reason || syn.reason || new Error("unavailable");
    const statuses = [fx.reason && fx.reason.status, syn.reason && syn.reason.status];
    const err = new Error("not retrieved");
    err.kind = statuses.some(s => s === 401 || s === 403) ? "private"
      : statuses.some(s => s === 404) ? "notfound"
      : statuses.some(s => s === 429) ? "ratelimit" : "unreachable";
    err.cause = e;
    throw err;
  }
  const pa = fromFx(A), pb = fromSyn(B);
  const post = tidyText(merge(pa, pb));
  post._rawFx = A; post._rawSyn = B;
  return post;
}
async function resolveQuiet(id) { try { return await resolve(id); } catch (e) { return null; } }

/* ---------- reposts ---------- */
async function profile(handle) {
  const h = String(handle || "").replace(/^@/, "");
  if (!/^\w{1,15}$/.test(h)) return null;
  try {
    const j = await getJson(`${FX}/${h}`);
    const u = j && j.user; if (!u) return null;
    return { name: u.name || u.screen_name, handle: u.screen_name || h, avatar: proxy(bigAvatar(u.avatar_url)), verified: verifiedFx(u) };
  } catch (e) { return null; }
}

// Looks inside what the sources returned for a sign that the link is a repost.
// Returns { by, original, originalId, partial } or null.
async function detectRepost(post) {
  const A = post._rawFx, B = post._rawSyn;
  // 1. The source states who reposted it and the post itself is the original.
  if (post._repostedBy && post._repostedBy.handle) return { by: post._repostedBy, original: post, source: "data" };
  // 2. The source returned a repost object that wraps the original.
  const wrapped = post._retweetedObj;
  if (wrapped) {
    const orig = (wrapped.user || wrapped.author) ? (fromSyn(wrapped) || fromFx(wrapped)) : null;
    const origId = String(wrapped.id_str || wrapped.id || "");
    let original = orig;
    if (origId && /^\d+$/.test(origId)) original = (await resolveQuiet(origId)) || orig;
    if (original) return { by: { name: post.author.name, handle: post.author.handle }, original: tidyText(original), source: "data" };
  }
  // 3. Old-style repost text: "RT @original: ..."
  const m = /^RT @(\w{1,15}):\s*([\s\S]*)$/.exec(post.text || "");
  if (m) {
    const prof = await profile(m[1]);
    if (prof) {
      const t = m[2];
      return {
        by: { name: post.author.name, handle: post.author.handle },
        original: { id: "", text: t, createdAt: null, author: prof, media: [], quote: null, replyingTo: null, source: null, metrics: {}, partial: true },
        source: "text", partial: true
      };
    }
  }
  return null;
}

/* ---------- handler ---------- */
function send(res, code, body, cache) {
  if (cache) res.setHeader("Cache-Control", cache);
  res.status(code).json(body);
}

module.exports = async (req, res) => {
  const q = req.query || {};

  if (q.profile) {
    const p = await profile(q.profile);
    if (!p) return send(res, 404, { error: "We couldn't find that account.", code: "profile_not_found" });
    return send(res, 200, { profile: p }, "s-maxage=600");
  }

  const id = String(q.id || "");
  if (!/^\d{5,25}$/.test(id)) return send(res, 400, { error: "That doesn't look like a post link.", code: "bad_id" });
  const parents = Math.max(0, Math.min(3, parseInt(q.parents, 10) || 0));

  let post;
  try { post = await resolve(id); }
  catch (e) {
    const map = {
      private: [403, "This post is private or protected, so PostShot can't read it.", "private"],
      notfound: [404, "That post wasn't found. It may have been deleted, or the link may be wrong.", "not_found"],
      ratelimit: [429, "Too many requests right now. Please wait a moment and try again.", "rate_limited"],
      unreachable: [502, "X didn't respond just now. Please try again in a moment.", "unreachable"]
    };
    const m = map[e.kind] || map.unreachable;
    return send(res, m[0], { error: m[1], code: m[2] });
  }

  const warnings = [];
  let shown = post, repostBy = null, repostSource = null;

  const rp = await detectRepost(post);
  if (rp) {
    shown = rp.original; repostBy = { name: rp.by.name, handle: rp.by.handle }; repostSource = rp.source;
    if (rp.partial) warnings.push("This repost only exposes the start of the original post's text, so it may be shortened. Paste the original post's link for the full version.");
  }

  // Quote post whose quoted post was not included: try to fetch it, else mark it unavailable.
  if (!shown.quote && shown._isQuote) {
    const qid = shown._quotedId || (shown._rawFx && shown._rawFx.quote_id) || null;
    const qp = qid ? await resolveQuiet(String(qid)) : null;
    if (qp) shown.quote = qp; else shown.quote = { unavailable: true, author: { name: "", handle: "" }, text: "", media: [] };
  }

  // Posts above this one in a conversation (optional).
  const thread = [];
  let parentAvailable = !!(shown.replyToId || shown._parent);
  if (parents && !repostBy) {
    let next = shown._parent || null, nextId = shown.replyToId;
    for (let i = 0; i < parents; i++) {
      let p = next; next = null;
      if (!p && nextId) p = await resolveQuiet(String(nextId));
      if (!p) break;
      thread.unshift(tidyText(p));
      nextId = p.replyToId; next = null;
      if (!nextId) break;
    }
  }

  // The link names a different account than the post's author: maybe a link taken from a repost.
  let hint = null;
  const urlHandle = String(q.handle || "").replace(/^@/, "");
  if (!repostBy && urlHandle && /^\w{1,15}$/.test(urlHandle) && !/^(i|web)$/i.test(urlHandle) && urlHandle.toLowerCase() !== String(shown.author.handle).toLowerCase()) {
    hint = { type: "possible_repost", handle: urlHandle };
  }

  // The person told us who reposted it: look up that account (no guessing).
  if (q.reposter && !repostBy) {
    const prof = await profile(q.reposter);
    if (!prof) return send(res, 404, { error: "We couldn't find the account @" + String(q.reposter).replace(/[^\w]/g, "") + ", so the repost line can't be added.", code: "profile_not_found" });
    repostBy = { name: prof.name, handle: prof.handle, verified: prof.verified };
    repostSource = "user";
  }

  const out = clean(shown);
  const body = {
    version: 2,
    post: out,
    repostBy: repostBy ? Object.assign({ detected: repostSource }, repostBy) : null,
    thread: thread.map(clean),
    parentAvailable,
    hint,
    warnings,
    // Fields from the first version of PostShot, kept so nothing that relied on them breaks
    name: out.author.name, handle: out.author.handle, text: out.text,
    avatar: out.author.avatar, image: (out.media.find(m => m.src) || {}).src || null,
    likes: out.metrics.likes, replies: out.metrics.replies != null ? out.metrics.replies : (shown._conversationCount != null ? shown._conversationCount : null),
    reposts: out.metrics.reposts, date: out.createdAt
  };
  send(res, 200, body, "s-maxage=120, stale-while-revalidate=300");
};

// exported for the automated tests
module.exports._internals = { fromFx, fromSyn, merge, tidyText };
