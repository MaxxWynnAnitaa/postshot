// Passes X pictures (and the emoji set) through our own domain so the screenshot
// export is never blocked by the browser's cross-site picture rules.
//   GET /api/img?u=https%3A%2F%2Fpbs.twimg.com%2Fmedia%2F...
const ALLOWED = [
  { host: "pbs.twimg.com", prefix: "/" },
  { host: "abs.twimg.com", prefix: "/" },
  { host: "cdn.jsdelivr.net", prefix: "/gh/jdecked/twemoji@" } // emoji pictures
];
const MAX_BYTES = 12 * 1024 * 1024;

module.exports = async (req, res) => {
  let u;
  try { u = new URL(String((req.query || {}).u)); } catch (e) { return res.status(400).end(); }
  const rule = ALLOWED.find(a => a.host === u.hostname && u.pathname.startsWith(a.prefix));
  if (u.protocol !== "https:" || !rule) return res.status(403).end();

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (compatible; PostShot/2.0)" }, signal: ctl.signal });
    if (!r.ok) return res.status(r.status === 404 ? 404 : 502).end();
    const type = r.headers.get("content-type") || "image/jpeg";
    if (!/^image\//i.test(type)) return res.status(415).end();
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) return res.status(413).end();
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).end();
  } finally { clearTimeout(timer); }
};
