// Fetches a public post and returns clean JSON for the front end.
const tok = id => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
const img = u => (u ? "/api/img?u=" + encodeURIComponent(u) : null);
const dec = s => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

async function viaSyndication(id) {
  const r = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${tok(id)}`, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("syndication " + r.status);
  const t = await r.json();
  if (!t || !t.user) throw new Error("no data");
  let text = dec(t.text || "");
  (t.entities?.urls || []).forEach(u => { text = text.replace(u.url, u.display_url || u.expanded_url); });
  (t.entities?.media || []).forEach(m => { text = text.replace(m.url, ""); });
  const md = t.mediaDetails || [];
  const ph = md.find(m => m.type === "photo") || md[0];
  return { name: t.user.name, handle: t.user.screen_name, text: text.trim(),
    avatar: img((t.user.profile_image_url_https || "").replace("_normal", "_400x400")),
    image: img(ph && ph.media_url_https), likes: t.favorite_count, replies: t.conversation_count, reposts: null, date: t.created_at };
}

async function viaFx(id) {
  const r = await fetch(`https://api.fxtwitter.com/status/${id}`);
  if (!r.ok) throw new Error("fx " + r.status);
  const t = (await r.json()).tweet;
  if (!t) throw new Error("no data");
  return { name: t.author.name, handle: t.author.screen_name, text: t.text,
    avatar: img(t.author.avatar_url), image: img(t.media?.photos?.[0]?.url),
    likes: t.likes, replies: t.replies, reposts: t.retweets, date: t.created_at };
}

module.exports = async (req, res) => {
  const id = String(req.query.id || "");
  if (!/^\d{5,25}$/.test(id)) return res.status(400).json({ error: "Bad post id" });
  for (const f of [viaSyndication, viaFx]) {
    try { const d = await f(id); res.setHeader("Cache-Control", "s-maxage=300"); return res.status(200).json(d); } catch (e) {}
  }
  res.status(404).json({ error: "Post not found or unavailable" });
};
