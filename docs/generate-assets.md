# Generating art & video with AI

The kit includes the same generators the original app used. They read your story
text from `public/js/stories.js` and produce matching art/video. **You provide
your own API keys** (these cost money on Google's side).

## What you need (one-time setup, Windows)
1. **Node** — already installed if the app runs (`node --version`).
2. **A Google AI key** for images + story text → put it in `.env` as `GEMINI_API_KEY=...`
   (copy `.env.example` to `.env` first).
3. **For video (Veo)** — a Google Cloud project with Vertex AI enabled, and the
   gcloud CLI. Sign in once so scripts can authenticate:
   ```powershell
   gcloud auth application-default login
   ```
   Then set your project id when running the video generator (below).

> Ask Claude Code: "help me set up a Google Cloud project and gcloud for Veo video
> generation on Windows" — it'll walk you through account + billing + the CLI.

## Generate per-chunk art for a story
```bash
node generate-art-v2.js the-lighthouse-keeper
```
Writes `art/the-lighthouse-keeper/chunk-0.png`, `chunk-1.png`, … from the story's
own chunk text. Re-run any time you change the story.

## Generate an intro or outro video for a story
```powershell
$env:GCP_PROJECT="your-gcp-project-id"
node generate-story-intros-v2.mjs --story the-lighthouse-keeper --mode intro
node generate-story-intros-v2.mjs --story the-lighthouse-keeper --mode outro

# add --dry-run to PRINT the prompt without spending video credit:
node generate-story-intros-v2.mjs --story the-lighthouse-keeper --mode outro --dry-run
```
- **intro** = an inviting opening scene that loops while the child reads.
- **outro** = a climactic closing scene.
- The generator writes the prompt itself (style + safety baked in).

## Important rule (kept from the original)
**Always generate video prompts with the generator, never by hand.** It keeps a
consistent look and applies content-safety automatically. To collect prompts for
pasting into a tool like Google Flow, run with `--dry-run` and copy what it prints.

## Where assets go
| Asset | Path |
|---|---|
| Chunk art | `art/<story-id>/chunk-N.png` |
| Intro video | `videos/intros/<story-id>.mp4` |
| Outro video | `videos/outros/<story-id>.mp4` |
| Guide character art | `art/seba-khafre/` (replace with your own, same filenames) |
