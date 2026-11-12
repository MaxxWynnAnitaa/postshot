# PostShot

Authentic screenshots of public X posts. Paste a link, check the preview, download a sharp PNG or JPG.
Reposts, quote posts, replies, photos, light / dim / dark.

No account, no database, no secret keys. It runs on a free Vercel Hobby plan.

---

## Deploy it (about 5 minutes)

You already have the repository `MaxxWynnAnitaa/postshot` connected to Vercel, so this is just a file swap.

1. **Unzip** this download. You will see `index.html`, `api/`, `js/`, `css/`, `fonts/`, `img/`, `vercel.json`, `package.json` and this README.
2. Open your repository on **github.com**.
3. **Delete the old files** so nothing conflicts: `index.html`, `api/tweet.js`, `api/img.js`, and any duplicate copies in the repository root. (Click a file, then the bin icon, then "Commit changes". Repeat for each.)
4. Click **Add file → Upload files**. Drag in **everything inside the unzipped folder** (the folders and the files). GitHub keeps the folder structure when you drag folders in.
   - If your browser will not accept folders, use the GitHub Desktop app, or upload each folder's contents with *Add file → Create new file* and type the path (for example `api/tweet.js`).
5. Click **Commit changes**.
6. Vercel notices the change and redeploys automatically (about a minute). Open `https://postshot-phi.vercel.app/`.

No environment variables are needed. `.env.example` only lists two optional overrides.

**Check it worked:** open your site, tap **Repost** under "Try a sample", and you should see a repost screenshot. Then paste a real post link.

### Files

| Path | What it is |
|---|---|
| `index.html` | The page |
| `css/studio.css` | The design |
| `js/app.js` | The studio: link reading, controls, export |
| `js/render.js` | The screenshot renderer (draws the post; used for both preview and export) |
| `js/samples.js` | Made-up sample posts so people can try the studio |
| `api/tweet.js` | Fetches a public post (kept from the first version, upgraded) |
| `api/img.js` | Passes X pictures through your own domain so export is not blocked |
| `fonts/` | Inter (post text) and Instrument Serif (headline), self-hosted |
| `vercel.json` | Cache settings for fonts |

---

## How it works

1. The link is read in the browser. `api/tweet.js` asks two public sources (the same two the first version used: fxtwitter and X's own embed service), merges what they return, and sends back one clean post object.
2. `js/render.js` draws the post onto a canvas in the layout of the X iPhone app (393 pt wide, as on an iPhone 15 Pro).
3. The **preview and the download are drawn by the same code**, so they match. Download is simply the same drawing at a higher resolution (2×, 3× or 4×). 3× gives 1179 px wide, the same as a real iPhone screenshot.

Nothing is stored. There is no tracking.

## Reposts, quotes, and what X lets us see

| Kind | What PostShot does |
|---|---|
| **Quote post** | Quoter's name and comment on top, the quoted post in a bordered card beneath. |
| **Official repost** | "Person B reposted" line, then the **original** author's photo, name, handle, badge, full text, pictures, time and numbers. Uses the timeline view, which is where X shows that line. |
| Repost the data can identify | Detected automatically (the source says who reposted, or returns a repost object, or the old `RT @name:` form). |
| Repost link that resolves to the original | When you copy a link from a repost, X normally gives the **original** post's link, so the reposter is not in the data. PostShot never guesses: if the link names a different @account than the author, it offers "Show as repost by @name". Or use **Repost → add username**. The name comes from that account's real public profile. |
| Deleted / unavailable quoted post | Shows X's own "This post is unavailable." card. Nothing invented. |
| Missing numbers | Left out (no `0`, no made-up figure). |

## Limitations (please read)

- **Public posts only.** Private, protected, deleted or age-restricted posts cannot be read.
- **Data sources are unofficial public endpoints.** They can change or rate-limit without notice. If a post fails, try again in a minute. If both ever stop working, `api/tweet.js` is the only file to change.
- **Fonts:** the X iPhone app uses Apple's SF Pro, which cannot be redistributed. PostShot uses Inter, its closest open match. Letter shapes are very close, not identical.
- **Emoji:** drawn with Twemoji (the set X uses on the web), not Apple's emoji, so they look the same on every phone. They load from a public CDN; if that is blocked, the device's own emoji are used.
- **Not supported yet:** polls, link cards, article posts, Community Notes, right-to-left scripts (Arabic, Hebrew) are laid out left-to-right, and video is a still frame with a play button.
- **Threads:** you can include the post being replied to (up to a few levels). Whole long threads are not fetched.
- **Post time:** shown in the viewer's own time zone, as the X app does. Timeline view shows relative time ("3h") like the app.
- **Posted-from app** (e.g. "Twitter for iPhone") is available as a switch, off by default because the current X iPhone app does not show it.
- Very tall images are limited so the file stays within what phones can handle. PostShot lowers the quality step automatically and tells you.

## Optional: run it on your own computer

You do not need this to deploy.

```
npm i -g vercel
vercel dev
```

Then open the address it prints.
