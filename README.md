# Reader Starter Kit

Your own themeable kids' **reading app** — leveled stories with read-aloud,
comprehension checkpoints, AI-generated art, and intro/outro videos. The engine
is built and working; you bring the theme, the stories, the art, and the voice.

## Quick start (Windows)

1. **Install Node.js** (LTS) from https://nodejs.org — then restart your terminal.
   Check it: `node --version`
2. **Get the project** (you already cloned this repo with Claude Code).
3. **Install dependencies:**
   ```powershell
   npm install
   ```
4. **Run it:**
   ```powershell
   node server.js
   ```
5. Open **http://localhost:3456** in your browser. You'll see the landing page;
   the library has 6 example stories (one per reading level). Click one to read it.

That's the whole app running. Everything below is how you make it *yours*.

## Make it yours
Open this folder in **Claude Code** and just describe what you want. Start here:
- **`CLAUDE.md`** — the map of the whole project (read this first).
- **`docs/add-a-story.md`** — add your own stories.
- **`docs/theme-it.md`** — colors, name, branding, and the guide character.
- **`docs/generate-assets.md`** — generate art + video with AI (needs your own Google keys).
- **`docs/remove-wings.md`** — delete optional extra sections you don't want.

## AI features (optional)
Story/art generation and read-aloud use Google AI. Copy `.env.example` to `.env`
and add your own keys when you're ready. The app runs and reads fine **without**
keys — you just won't have the AI-generated extras until you add them.

## What's included
- The reading engine (`maat-reader.html`) + server (`server.js`).
- 6 example stories (L1–L6) **with art**, plus one example outro video.
- The original guide-character + hero art (replace with your own).
- The AI generators for art and video.
- Full docs for customizing everything.

## Tip: if a change doesn't show up
This app uses a service worker that caches aggressively. If you edit something and
the browser still shows the old version, open DevTools → Application → "Clear site
data," or bump the `?v=` number on the file you changed.

Have fun building it. 🌟
