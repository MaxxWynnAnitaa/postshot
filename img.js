// Passes X images through our own domain so the screenshot export isn't blocked.
module.exports = async (req, res) => {
  let u; try { u = new URL(String(req.query.u)); } catch { return res.status(400).end(); }
  if (u.protocol !== "https:" || u.hostname !== "pbs.twimg.com") return res.status(403).end();
  const r = await fetch(u);
  if (!r.ok) return res.status(502).end();
  res.setHeader("Content-Type", r.headers.get("content-type") || "image/jpeg");
  res.setHeader("Cache-Control", "public, s-maxage=86400");
  res.status(200).send(Buffer.from(await r.arrayBuffer()));
};
