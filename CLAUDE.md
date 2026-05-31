# Reader Starter Kit

A themeable kids' **reading app** you can make your own: leveled stories (L1–L6)
with read-aloud, comprehension checkpoints, per-chunk AI art, and intro/outro
videos. Forked from a working production app — the engine is done; you swap in
**your** stories, art, video, colors, and guide character.

> You're working with Claude Code. When you want to change something, describe it
> in plain language ("add a new story about X", "make the colors purple and
> teal", "rename the guide character to Nayla") and let Claude Code do the edits,
> using the docs below as the map.

## What to read first
- `README.md` — install Node, run the app, see it in your browser.
- `docs/add-a-story.md` — the story format + how to add your own.
- `docs/generate-assets.md` — generate art + video with AI (needs your own keys).
- `docs/theme-it.md` — colors, app name, branding, the guide character.
- `docs/remove-wings.md` — optional advanced features you can delete.

## Stack
- Node.js (CommonJS). Backend: `server.js` (Express, port **3456**).
- Frontend: one self-contained file, **`maat-reader.html`**.
- Story data: **`public/js/stories.js`** (a global `var STORIES = [...]`). ← your content.
- AI features API: `seba-story-api.mjs` (story + art generation, read-aloud) — optional, needs `GEMINI_API_KEY`.

## Run it
```bash
npm install
node server.js        # then open http://localhost:3456
```

## The 6 things you change to make it yours
1. **`public/js/stories.js`** — your stories (see `docs/add-a-story.md`). Ships with 6 examples, one per level.
2. **Colors** — the CSS `:root` tokens near the top of `maat-reader.html` (see `docs/theme-it.md`).
3. **Name & branding** — title, landing copy, favicon, `manifest.json`.
4. **Guide character** — the teacher/helper persona (originally "Seba"); art in `art/seba-khafre/` (see `docs/theme-it.md`).
5. **`art/<story-id>/` + `videos/`** — your images and clips (generate or drop in).
6. **`.env`** — your own API keys (copy from `.env.example`).

## Level system (kept from the engine)
| Level | Grade | Chunks | Words/chunk | Score gate |
|---|---|---|---|---|
| L1 | 3 | 12 | 80–100 | — |
| L2 | 4 | 15 | 100–120 | 50% |
| L3 | 5 | 17–18 | 120–160 | 55% |
| L4 | 6 | 21–24 | 120–160 | 65% |
| L5 | 7 | 26–27 | 150–180 | 75% |
| L6 | 8 | 22–28 | 180–200 | 80% |

## Working rules (worth keeping)
- **Don't hand-write AI video prompts** — use the generator (`docs/generate-assets.md`). It handles safety + style consistency.
- **Bump the `?v=YYYYMMDD` on a `<script>`/`<link>`/asset when you change it** — browsers cache aggressively. (A stale service worker can keep serving an old version even after a refresh — clear site data if a change won't show.)
- **Run the app in a browser and click through after a change** — don't trust "it looks right in the code."
- **Replace the guide art, don't just delete it.** `art/seba-khafre/` images are referenced on the landing/reader; if they're missing the app shows a broken image. Swap them for your own with the same filenames.
- Keep secrets in `.env`, never in the HTML/JS that ships to the browser.

## Notes
- Some advanced "wings" from the original app (a daily-ritual section called
  *senebty*, a timeline, ruler pages) are still in the code but hidden. Ignore
  them, or remove them with `docs/remove-wings.md`.
- This kit ships 6 example stories with art (and one example outro video) so it
  runs immediately. Replace them with your own.
