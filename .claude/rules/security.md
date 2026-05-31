# Security Rules

- Never pass user URLs directly to shell — always use spawn with args array
- Validate URLs before passing to yt-dlp
- Never expose server credentials, API keys, or SSH keys in frontend code
- CORS is enabled — be mindful of allowed origins in production
