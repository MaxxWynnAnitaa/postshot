/*  PostShot sample posts
 *  Fictional accounts and generated artwork, so people can try the studio
 *  without importing anything. Nothing here is a real post.
 *  Pictures use the address "art:name" and are drawn on the fly.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PostShotSamples = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PALETTES = {
    dusk:   ["#1f2a44", "#7b4b94", "#f08a5d", "#f9d56e"],
    coast:  ["#0b3954", "#087e8b", "#bfd7ea", "#ff5a5f"],
    forest: ["#0f2a1d", "#2d6a4f", "#95d5b2", "#f4e285"],
    studio: ["#2b2d42", "#8d99ae", "#edf2f4", "#ef233c"],
    sand:   ["#3d2c1e", "#b5835a", "#e9c9a0", "#fff4e0"],
    ink:    ["#10151f", "#2f4858", "#86bbd8", "#f6ae2d"]
  };

  function scene(make, w, h, name) {
    var p = PALETTES[name] || PALETTES.dusk, c = make(w, h), x = c.getContext("2d");
    var g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, p[0]); g.addColorStop(0.55, p[1]); g.addColorStop(1, p[2]);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    var s = x.createRadialGradient(w * 0.7, h * 0.34, 0, w * 0.7, h * 0.34, h * 0.28);
    s.addColorStop(0, p[3]); s.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = s; x.fillRect(0, 0, w, h);
    x.fillStyle = p[3]; x.beginPath(); x.arc(w * 0.7, h * 0.34, h * 0.07, 0, Math.PI * 2); x.fill();
    [[0.62, 0.35, 0.5], [0.72, 0.22, 0.75], [0.84, 0.12, 1]].forEach(function (L, i) {
      x.fillStyle = "rgba(8,12,20," + (0.22 + i * 0.25) + ")";
      x.beginPath(); x.moveTo(0, h);
      for (var px = 0; px <= w; px += 8) {
        var y = h * L[0] + Math.sin(px / w * (3 + i * 1.7) + i * 2) * h * L[1] * 0.35 + Math.sin(px / w * 11 + i) * h * 0.012;
        x.lineTo(px, y);
      }
      x.lineTo(w, h); x.closePath(); x.fill();
    });
    return c;
  }
  function avatar(make, letter, a, b) {
    var c = make(200, 200), x = c.getContext("2d");
    var g = x.createLinearGradient(0, 0, 200, 200); g.addColorStop(0, a); g.addColorStop(1, b);
    x.fillStyle = g; x.fillRect(0, 0, 200, 200);
    x.fillStyle = "rgba(255,255,255,.92)"; x.font = "600 96px Inter, sans-serif"; x.textAlign = "center";
    x.fillText(letter, 100, 134);
    return c;
  }

  function build(make) {
    var art = {
      "art:av-maren": avatar(make, "M", "#7b4b94", "#f08a5d"),
      "art:av-atlas": avatar(make, "A", "#0b3954", "#087e8b"),
      "art:av-dev": avatar(make, "D", "#2d6a4f", "#95d5b2"),
      "art:av-lindiwe": avatar(make, "L", "#b5835a", "#3d2c1e"),
      "art:wide": scene(make, 1280, 720, "dusk"),
      "art:four-three": scene(make, 1200, 900, "coast"),
      "art:g1": scene(make, 900, 900, "forest"),
      "art:g2": scene(make, 900, 900, "sand"),
      "art:g3": scene(make, 900, 900, "studio"),
      "art:g4": scene(make, 900, 900, "ink"),
      "art:atlas-photo": scene(make, 1200, 900, "coast")
    };

    var maren = { name: "Maren Holt", handle: "marenholt", avatar: "art:av-maren", verified: "blue" };
    var atlas = { name: "Atlas Journal", handle: "atlasjournal", avatar: "art:av-atlas", verified: "gold" };
    var dev = { name: "Dev Kapoor", handle: "devbuilds", avatar: "art:av-dev", verified: null };
    var lindiwe = { name: "Lindiwe Dube \ud83c\udf3f", handle: "lindiwe_d", avatar: "art:av-lindiwe", verified: null };

    var atlasPost = {
      id: "s-atlas", author: atlas, createdAt: "2026-11-10T07:15:00Z",
      text: "The old harbour lighthouse reopens to visitors this weekend after a two-year restoration.\n\nTickets are free for the first 500 guests.",
      media: [{ type: "photo", src: "art:atlas-photo", width: 1200, height: 900 }],
      metrics: { replies: 214, reposts: 1893, likes: 12400, views: 482000, bookmarks: 640 }
    };

    var samples = [
      { id: "text", label: "Short text", model: { post: {
        id: "s-text", author: dev, createdAt: "2026-11-11T15:42:00Z",
        text: "Shipped the new onboarding today. Fewer steps, clearer wording, and a lot less scrolling. #buildinpublic",
        media: [], metrics: { replies: 18, reposts: 42, likes: 611, views: 18300 } } } },
      { id: "long", label: "Long post", model: { post: {
        id: "s-long", author: maren, createdAt: "2026-11-09T18:05:00Z",
        text: "Three things I wish I knew before my first year of design school:\n\n1. Nobody remembers your first draft. Ship it, then make it better.\n2. Taste is trained, not born. Look at great work every single day \u2728\n3. Say \u201cI don\u2019t know yet\u201d \u2014 it\u2019s the fastest way to learn.\n\nAlso: caf\u00e9 crawls in S\u00e3o Paulo & Z\u00fcrich count as research \u2615\ufe0f\ud83c\udde7\ud83c\uddf7\n\nWhat would you add? Replies open, I read all of them. https://marenholt.example/notes/first-year",
        media: [], metrics: { replies: 392, reposts: 2210, likes: 18700, views: 910000, bookmarks: 5400 } } } },
      { id: "photo", label: "One photo", model: { post: {
        id: "s-photo", author: maren, createdAt: "2026-11-08T06:30:00Z",
        text: "First light over the ridge this morning. Worth the 5am alarm.",
        media: [{ type: "photo", src: "art:wide", width: 1280, height: 720 }],
        metrics: { replies: 56, reposts: 130, likes: 3120, views: 64000 } } } },
      { id: "gallery", label: "Four photos", model: { post: {
        id: "s-gallery", author: lindiwe, createdAt: "2026-11-07T12:10:00Z",
        text: "Studio week in four frames.",
        media: ["art:g1", "art:g2", "art:g3", "art:g4"].map(function (s) { return { type: "photo", src: s, width: 900, height: 900 }; }),
        metrics: { replies: 9, reposts: 21, likes: 402, views: 9800 } } } },
      { id: "quote", label: "Quote post", model: { post: {
        id: "s-quote", author: lindiwe, createdAt: "2026-11-10T09:40:00Z",
        text: "This is the kind of local news I want more of. Going this weekend.",
        media: [], quote: atlasPost,
        metrics: { replies: 7, reposts: 12, likes: 288, views: 7100 } } } },
      { id: "repost", label: "Repost", model: {
        repostBy: { name: "Maren Holt", handle: "marenholt", detected: "sample" },
        post: atlasPost } },
      { id: "reply", label: "Reply", model: { post: {
        id: "s-reply", author: dev, createdAt: "2026-11-11T16:20:00Z", replyingTo: "marenholt",
        text: "Number 2 is the one I keep coming back to. Looking at good work daily changed how I review my own.",
        media: [], metrics: { replies: 2, reposts: 1, likes: 47, views: 1900 } } } },
      { id: "nometrics", label: "No numbers", model: { post: {
        id: "s-nometrics", author: dev, createdAt: "2026-11-12T08:05:00Z",
        text: "Some posts come back without engagement numbers. PostShot leaves them out instead of guessing.",
        media: [], metrics: {} } } }
    ];
    return { art: art, samples: samples, accounts: { maren: maren, atlas: atlas, dev: dev, lindiwe: lindiwe } };
  }

  return { build: build };
});
