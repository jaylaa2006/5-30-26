---
paths: server.js
---
# Server Rules

- Express 5 — use `req.body` with `express.json()` middleware
- Spawn yt-dlp/ffmpeg via `child_process.spawn`, never `exec` (avoid shell injection)
- Track active downloads in the `activeDownloads` Map
- Use COOKIE_ARGS array for yt-dlp authentication
- Download directory: `~/Documents`
