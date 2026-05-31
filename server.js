require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs/promises');
const os = require('os');
const crypto = require('crypto');
const { extractAndDownload, extractInfo } = require('./fallback-extractor');
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const SEBA_FROM_EMAIL = process.env.SEBA_FROM_EMAIL || 'seba@osiriscare.net';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Production guard — disable TubeGrab/download endpoints in production
function devOnly(req, res, next) {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'Not available' });
  next();
}

const MAX_CONCURRENT = 5;

// Skip compression for already-compressed binary formats (PNG, MP4, WebM, etc.)
app.use(compression({
  filter: (req, res) => {
    if (/\.(png|jpg|jpeg|gif|mp4|webm|mp3|wav|flac|ogg|woff2?)$/i.test(req.path)) return false;
    return compression.filter(req, res);
  }
}));
// CORS: restrict to same-origin + localhost dev
const ALLOWED_ORIGINS = [
  'https://withouthistory.osiriscare.net',
  'http://localhost:3456',
  'http://127.0.0.1:3456'
];
app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin requests (no origin header) and allowed origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(null, false);
  }
}));
app.use(express.json({ limit: '200kb' }));
// Coerce req.body to {} so `const { x } = req.body` never throws on empty/malformed requests.
// Fixes the class of TypeError: Cannot destructure property 'x' of 'req.body' as it is undefined.
app.use((req, res, next) => { if (req.body == null) req.body = {}; next(); });
// express.json() emits SyntaxError / entity.too.large for malformed bodies; return a 400 instead of 500.
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large' || err instanceof SyntaxError)) {
    return res.status(400).json({ error: 'Invalid or oversized JSON body' });
  }
  next(err);
});

// Security headers. nginx also sets some of these in prod; keep Express as the source of truth so
// dev-direct-to-3456 behaves the same as prod. nginx-side duplicates removed in nginx conf.
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://*.googleusercontent.com https://i.ytimg.com https://yt3.googleusercontent.com",
    "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://*.cognitiveservices.azure.com https://*.tts.speech.microsoft.com https://*.stt.speech.microsoft.com wss://*.stt.speech.microsoft.com wss://*.tts.speech.microsoft.com",
    "frame-src https://accounts.google.com https://www.youtube-nocookie.com https://www.youtube.com",
    "frame-ancestors 'none'",
    "media-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "report-uri /api/csp-report"
  ].join('; '));
  next();
});
// Block access to sensitive files — dotfiles, server code, configs
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  // Block dotfiles/dirs (allow .well-known for Android asset links)
  if (/\/\./.test(p) && !p.startsWith('/.well-known/')) return res.status(403).end();
  // Block server-side JS, configs, markdown (allow sw.js, manifest.json)
  if (/\.(js|mjs|json|md|sh|env|log)$/i.test(p) && p !== '/maat-reader.html' && p !== '/sw.js' && p !== '/manifest.json' && !p.startsWith('/js/') && !(p.startsWith('/senebty/') && /\.(js|mjs|json)$/i.test(p))) return res.status(403).end();
  next();
});
// Art + video assets cached aggressively (immutable content, regenerated with new filenames)
app.use('/art', express.static(path.join(__dirname, 'art'), { maxAge: '30d', etag: false, immutable: true }));
app.use('/videos', express.static(path.join(__dirname, 'videos'), { maxAge: '30d', etag: true }));
// Senebty section — JS modules, CSS, lesson data
app.use('/senebty/data/sources/raw', (req, res) => res.status(404).end());
app.use('/senebty/data/sources/ocr', (req, res) => res.status(404).end());
app.use('/senebty', express.static(path.join(__dirname, 'senebty'), { maxAge: '1h', etag: true }));
// SEO: prerendered, crawlable per-story pages (generated by
// scripts/prerender-stories.mjs into public/stories/). Clean URLs:
//   /stories          → hub index of all stories
//   /stories/<slug>   → one static story page (real text + Article JSON-LD)
// Registered BEFORE express.static so the clean URLs win over the static
// directory-redirect for the public/stories/ folder. Slug is path-validated
// (^[a-z0-9-]+$) to block traversal; missing file → 404.
app.get('/stories', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stories', 'index.html'), { maxAge: '1h' }, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});
app.get('/stories/:slug', (req, res) => {
  const slug = String(req.params.slug || '');
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(404).end();
  res.sendFile(path.join(__dirname, 'public', 'stories', slug + '.html'), { maxAge: '1h' }, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});
// v3.51.74 — Explicit /sw.js route MUST come BEFORE the express.static('public')
// mount below, or the static mount intercepts and serves with Cache-Control:
// public, max-age=3600. Cloudflare then rewrites that to its own default
// (max-age=14400 = 4h), DEFEATING service-worker updates for up to 4 hours
// across the edge. nginx's `add_header Cache-Control "no-cache"` on the
// `location = /sw.js` block ADDS a second header rather than overriding the
// upstream one — Cloudflare picks the first/max-age variant and drops no-cache.
// This route sets Cache-Control: no-cache directly so the upstream header
// itself is correct, leaving no ambiguity for nginx OR CF to "improve" away.
//
// File path: `public/sw.js` (canonical — same file express.static would have
// served; we just need explicit headers + route ordering).
//
// Locked by `tests/sw-deploy-path.test.mjs`.
app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'), { maxAge: 0 });
});
// Only serve specific public files — not the entire project directory
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));
// Serve maat-reader.html and icon explicitly
app.get(['/', '/reader', '/maat-reader.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'maat-reader.html'), { maxAge: '1h', dotfiles: 'allow' });
});
app.get('/icon.svg', (req, res) => {
  res.sendFile(path.join(__dirname, 'icon.svg'), { maxAge: '7d' });
});
// Favicons — generated from favicon.svg via scripts/generate-favicons.mjs
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'favicon.ico'), { maxAge: '7d' });
});
app.get('/favicon-16x16.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'favicon-16x16.png'), { maxAge: '7d' });
});
app.get('/favicon-32x32.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'favicon-32x32.png'), { maxAge: '7d' });
});
app.get('/apple-touch-icon.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'apple-touch-icon.png'), { maxAge: '7d' });
});
app.get('/apple-touch-icon-precomposed.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'apple-touch-icon-precomposed.png'), { maxAge: '7d' });
});
// PWA assets
app.use('/icons', express.static(path.join(__dirname, 'icons'), { maxAge: '30d', immutable: true }));
app.use('/.well-known', express.static(path.join(__dirname, '.well-known'), { maxAge: '1h' }));
app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'manifest.json'), { maxAge: '1h' }));
// Admin dashboard
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
// TubeGrab frontend (local dev only)
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/tubegrab.html', (req, res) => res.sendFile(path.join(__dirname, 'tubegrab.html')));

const DOWNLOAD_DIR = path.join(os.homedir(), 'Documents');

// Ensure download dir exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// ── F5 Wedeha PHOTO_IRI env-var enforcement (per docs/superpowers/specs/2026-05-16-...) ──
// Boot-blocking in production mirrors the CHUNK_SIGNING_SECRET pattern in seba-story-api.mjs.
// In dev (NODE_ENV unset or 'development'), PHOTO_KEY is null and all photo endpoints
// return 503 rather than encrypting/decrypting — this is expected and safe.
if (process.env.NODE_ENV === 'production') {
  if (!process.env.PHOTO_ENCRYPTION_KEY || process.env.PHOTO_ENCRYPTION_KEY.length !== 64) {
    console.error('[FATAL] PHOTO_ENCRYPTION_KEY missing or wrong length (expected 64 hex chars). F5 Wedeha cannot operate.');
    process.exit(1);
  }
  if (!process.env.PHOTO_HASH_SALT || process.env.PHOTO_HASH_SALT.length < 32) {
    console.error('[FATAL] PHOTO_HASH_SALT missing or too short (>=32 chars). F5 Wedeha cannot operate.');
    process.exit(1);
  }
}
const PHOTO_KEY = process.env.PHOTO_ENCRYPTION_KEY
  ? Buffer.from(process.env.PHOTO_ENCRYPTION_KEY, 'hex')
  : null;
const PHOTO_SALT = process.env.PHOTO_HASH_SALT || '';
const PHOTOS_ROOT = process.env.PHOTOS_ROOT || '/var/www/perankh/photos';

// Boot-time integrity scan — logs WARN on any .enc file that cannot be decrypted
// with the current PHOTO_KEY (e.g., files left from a key rotation). Runs once at
// startup. Silent catch on walk errors is intentional: PHOTOS_ROOT may not exist on
// a fresh deploy, which is normal and not an error condition.
function _photoIntegrityScan() {
  if (!PHOTO_KEY) return;
  const photoStore = require('./senebty/photo-store.js');
  let scanned = 0, orphans = 0;
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { return; }
    for (const ent of entries) {
      const p = `${dir}/${ent.name}`;
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.enc')) {
        scanned++;
        try {
          const env = fs.readFileSync(p);
          photoStore.decryptBytes(env, PHOTO_KEY);
        } catch (e) {
          orphans++;
          console.warn('[photo-integrity] undecryptable orphan (manual cleanup required):', p);
        }
      }
    }
  }
  try { walk(PHOTOS_ROOT); } catch (e) { /* dir may not exist on fresh deploy */ }
  console.log(`[photo-integrity] scanned=${scanned} orphans=${orphans}`);
}
_photoIntegrityScan();

// Active downloads tracked by ID
const activeDownloads = new Map();
// Cleanup completed/errored downloads after 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, dl] of activeDownloads) {
    if ((dl.status === 'completed' || dl.status === 'error' || dl.status === 'cancelled') && dl._doneAt && dl._doneAt < cutoff) {
      activeDownloads.delete(id);
    }
  }
}, 5 * 60 * 1000);

// yt-dlp binary resolver. PM2 under systemd strips PATH, so `spawn('yt-dlp')` ENOENTs in prod
// even when the binary exists. Probe once at boot and cache the absolute path.
// v3.44.0 — Resilient yt-dlp binary resolution.
//
// Prior shape: resolved ONCE at module-load via `fs.existsSync` cascade. If
// the cascade missed (filesystem race, PM2 chroot, etc.) it fell through to
// the bare string `'yt-dlp'`, which then failed at spawn-time with
// "spawn yt-dlp ENOENT" because PM2's PATH may not include /usr/bin.
// Confirmed in prod logs: root cause of the parent-portal video feed being
// blank ("Feed temporarily unavailable" from /api/learn-more-library/feed).
//
// New shape: lazy-resolve at first use, log the resolution, and re-check at
// each call so transient module-load races don't permanently hose the binary.
const YT_DLP_BIN_CANDIDATES = [
  process.env.YT_DLP_BIN,
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp',
  '/opt/homebrew/bin/yt-dlp',
].filter(Boolean);

let _ytDlpBinResolved = null;
let _ytDlpValidated = null; // last candidate proven to actually run (--version ok)

// v3.51.x — existence is not executability. PM2 under systemd strips PATH, so a
// candidate can EXIST yet fail to spawn (the apt /usr/bin/yt-dlp is a wrapper
// that shells out and ENOENTs without PATH — the v3.44.x cold-start failure).
// A cheap, cached one-time `--version` proves the binary runs in THIS process
// context before we commit to it.
function _ytDlpRuns(p) {
  try {
    const r = spawnSync(p, ['--version'], { timeout: 5000, stdio: 'ignore' });
    return r && r.status === 0;
  } catch { return false; }
}

function getYtDlpBin() {
  // v3.44.0 — priority-aware resolution: iterate candidates top-down every call
  // so a higher-priority binary installed AFTER server start is picked up
  // without a restart. v3.51.x — also VALIDATE the candidate executes; a
  // present-but-broken binary is skipped instead of silently failing at feed
  // time. existsSync is re-checked every call (a removed binary falls through);
  // the --version probe is cached per resolved path so we don't re-spawn.
  for (const p of YT_DLP_BIN_CANDIDATES) {
    if (!fs.existsSync(p)) continue;
    if (_ytDlpValidated === p) return p; // already proven to run — no re-spawn
    if (_ytDlpRuns(p)) {
      _ytDlpValidated = p;
      if (_ytDlpBinResolved !== p) {
        console.log('[yt-dlp] resolved + validated binary:', p, _ytDlpBinResolved ? '(was: ' + _ytDlpBinResolved + ')' : '');
        _ytDlpBinResolved = p;
      }
      return p;
    }
    console.warn('[yt-dlp] candidate exists but failed --version, skipping:', p);
  }
  if (_ytDlpBinResolved !== 'yt-dlp') {
    console.warn('[yt-dlp] no working binary in YT_DLP_BIN_CANDIDATES; falling back to PATH lookup ("yt-dlp")');
    _ytDlpBinResolved = 'yt-dlp';
  }
  _ytDlpValidated = null;
  return 'yt-dlp';
}

// Eagerly resolve once + log; call sites pass `YT_DLP_BIN` to spawn directly.
// If module-load happens to race the binary install (rare), getYtDlpBin() can
// be called explicitly at any later point to re-resolve.
const YT_DLP_BIN = getYtDlpBin();

// Common args for cookie auth and compatibility
const COOKIE_ARGS = ['--cookies-from-browser', 'chrome', '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'];

// URL validation — block SSRF (internal IPs, file://, cloud metadata)
function validateUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    // Block IPv6 addresses
    if (host.includes(':') || host.startsWith('[')) return false;
    // Block decimal IP encoding (all-numeric hostnames like "2130706433")
    if (/^\d+$/.test(host)) return false;
    // Block hex IP encoding (0x prefix)
    if (/^0x/i.test(host)) return false;
    // Block octal IP encoding (leading zeros in octets, e.g. "0177.0.0.1")
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const octets = host.split('.');
      if (octets.some(o => o.length > 1 && o.startsWith('0'))) return false;
    }
    // Block internal/private IPs and cloud metadata
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return false;
    if (host.startsWith('10.') || host.startsWith('192.168.')) return false;
    if (host.startsWith('172.') && parseInt(host.split('.')[1]) >= 16 && parseInt(host.split('.')[1]) <= 31) return false;
    // Block link-local range 169.254.0.0/16
    if (host.startsWith('169.254.')) return false;
    if (host.endsWith('.internal') || host.endsWith('.local')) return false;
    return true;
  } catch { return false; }
}

// Kill a spawned process after timeout
const PROCESS_TIMEOUT = 10 * 60 * 1000; // 10 minutes
function withTimeout(proc, ms = PROCESS_TIMEOUT) {
  const timer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, ms);
  proc.on('close', () => clearTimeout(timer));
  return proc;
}

// CSP violation reports — logged with rate limit, never respond with content
const _cspReportCounts = new Map();
app.post('/api/csp-report', express.json({ type: ['application/csp-report', 'application/json'], limit: '8kb' }), (req, res) => {
  const ip = req.ip || 'unknown';
  const n = (_cspReportCounts.get(ip) || 0) + 1;
  _cspReportCounts.set(ip, n);
  if (n <= 20) {
    const r = req.body?.['csp-report'] || req.body || {};
    console.log('[CSP]', JSON.stringify({
      docUri: r['document-uri'], violated: r['violated-directive'],
      blocked: r['blocked-uri'], original: r['original-policy'] ? 'present' : 'absent',
    }));
  }
  res.status(204).end();
});

// ─── [BACKDROP] telemetry ingest + 6h digest (v3.51.56) ───────────────────
// The browser emits [LANDING-VIDEO]/[BACKDROP] console events for every
// backdrop-video lifecycle step (init, load_started, canplay, stalled,
// play_rejected, error, posters_only). The client samples 1-in-N sessions
// and beacons batches here. We roll them into a single [BACKDROP-DIGEST]
// line every 6h so on-call can see canplay timing, stall/error rates, and
// tier distribution at a glance — closing the observability gap that made
// the v3.51.44 + v3.51.54 slowness reports mouth-feel-only.
const backdropTelemetryCounter = {
  events: new Map(), // key: event|tier → count
  canplayMs: [],     // sampled ms_to_canplay values
  windowStartedAt: Date.now(),
};
const _backdropIngestCounts = new Map(); // per-IP request cap (abuse guard)
const KNOWN_BACKDROP_EVENTS = new Set([
  'backdrop_init', 'init', 'load_started', 'canplay', 'hero_canplay',
  'stalled', 'play_rejected', 'resume_rejected', 'error', 'posters_only',
  'home_posters_only', 'library_posters_only', 'reader_posters_only',
  'reader_setup', 'reader_load_started', 'reader_canplay', 'reader_error',
  'tab_hidden', 'tab_visible',
]);
function recordBackdropEvent(event, tier, msToCanplay) {
  const e = (typeof event === 'string' && KNOWN_BACKDROP_EVENTS.has(event)) ? event : 'other';
  const t = (typeof tier === 'string' && tier.length <= 16) ? tier : '?';
  const k = e + '|' + t;
  backdropTelemetryCounter.events.set(k, (backdropTelemetryCounter.events.get(k) || 0) + 1);
  if (typeof msToCanplay === 'number' && msToCanplay >= 0 && msToCanplay < 120000) {
    // Keep at most 500 samples so the array can't grow unbounded.
    if (backdropTelemetryCounter.canplayMs.length < 500) backdropTelemetryCounter.canplayMs.push(msToCanplay);
  }
}
app.post('/api/telemetry/backdrop', express.json({ limit: '16kb' }), (req, res) => {
  const ip = req.ip || 'unknown';
  const n = (_backdropIngestCounts.get(ip) || 0) + 1;
  _backdropIngestCounts.set(ip, n);
  // Per-IP cap: 60 beacons per process-lifetime window keeps a single client
  // from flooding the counter. Cleared on the 6h digest flush.
  if (n > 60) return res.status(204).end();
  const events = Array.isArray(req.body?.events) ? req.body.events.slice(0, 50) : [];
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    recordBackdropEvent(ev.event, ev.tier, ev.ms_to_canplay);
  }
  res.status(204).end();
});
const BACKDROP_DIGEST_MS = 6 * 60 * 60 * 1000;
// A sustained run of stalls/errors/play-rejects in 6h signals a real
// throughput or asset problem worth paging on.
const BACKDROP_WARN_THRESHOLD = 100;
function flushBackdropDigest(reason) {
  const entries = [...backdropTelemetryCounter.events.entries()];
  _backdropIngestCounts.clear();
  if (entries.length === 0) {
    backdropTelemetryCounter.windowStartedAt = Date.now();
    return;
  }
  const total = entries.reduce((a, [, n]) => a + n, 0);
  const breakdown = entries.sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join(' ');
  // p50/p95 canplay latency from the sample.
  const ms = backdropTelemetryCounter.canplayMs.slice().sort((a, b) => a - b);
  const pct = (p) => ms.length ? ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] : null;
  // WARN if any single failure-class event (stalled/error/play_rejected) is high.
  const failCount = entries
    .filter(([k]) => /^(stalled|error|play_rejected|reader_error)\|/.test(k))
    .reduce((a, [, n]) => a + n, 0);
  const level = failCount >= BACKDROP_WARN_THRESHOLD ? 'WARN' : 'INFO';
  console.log('[BACKDROP-DIGEST] ' + JSON.stringify({
    schema: 'v1', level, source: 'server',
    window_started_at: backdropTelemetryCounter.windowStartedAt,
    window_ended_at: Date.now(),
    flush_reason: reason || 'interval',
    total, fail_count: failCount,
    canplay_p50_ms: pct(0.5), canplay_p95_ms: pct(0.95), canplay_samples: ms.length,
    by_event_tier: breakdown,
  }));
  backdropTelemetryCounter.events.clear();
  backdropTelemetryCounter.canplayMs.length = 0;
  backdropTelemetryCounter.windowStartedAt = Date.now();
}
setInterval(() => flushBackdropDigest('interval'), BACKDROP_DIGEST_MS).unref?.();
process.on('SIGTERM', () => { try { flushBackdropDigest('sigterm'); } catch (_) {} });
process.on('SIGINT',  () => { try { flushBackdropDigest('sigint'); } catch (_) {} });

// ─── GET VIDEO INFO ───
app.post('/api/info', devOnly, (req, res) => {
  if (!rateLimit(req.ip, 10)) return res.status(429).json({ error: 'Too many requests. Please wait.' });
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  if (!validateUrl(url)) return res.status(400).json({ error: 'Invalid URL' });

  const args = [
    ...COOKIE_ARGS,
    '--dump-json',
    '--no-download',
    '--no-warnings',
    '--no-playlist',
    url
  ];

  const proc = withTimeout(spawn(YT_DLP_BIN, args), 60000);
  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', d => stdout += d);
  proc.stderr.on('data', d => stderr += d);

  proc.on('close', async (code) => {
    if (code === 0) {
      try {
        const info = JSON.parse(stdout);
        const formats = info.formats || [];

        const qualities = new Set();
        formats.forEach(f => {
          if (f.height) {
            if (f.height >= 2160) qualities.add('4k');
            if (f.height >= 1080) qualities.add('1080');
            if (f.height >= 720) qualities.add('720');
            if (f.height >= 480) qualities.add('480');
            if (f.height >= 360) qualities.add('360');
          }
        });

        return res.json({
          title: info.title || 'Unknown',
          channel: info.uploader || info.channel || 'Unknown',
          duration: info.duration_string || formatDuration(info.duration),
          views: formatViews(info.view_count),
          upload_date: info.upload_date || '',
          thumbnail: info.thumbnail || '',
          description: (info.description || '').slice(0, 200),
          qualities: Array.from(qualities),
          filesize_approx: info.filesize_approx || info.filesize || null,
          url: url,
          is_playlist: false,
          method: 'yt-dlp'
        });
      } catch (e) {
        // Fall through to fallback
      }
    }

    // ── FALLBACK: custom extractor ──
    console.log(`[fallback] yt-dlp failed for ${url}, trying custom extractor...`);
    try {
      const info = await extractInfo(url);
      return res.json({
        title: info.title,
        channel: '',
        duration: info.duration,
        views: '',
        upload_date: '',
        thumbnail: info.thumbnail,
        description: '',
        qualities: info.qualities.length > 0 ? info.qualities : ['720', '480'],
        filesize_approx: null,
        url: url,
        is_playlist: false,
        method: 'fallback',
        streams_found: info.streams
      });
    } catch (fallbackErr) {
      return res.status(500).json({
        error: 'Could not extract video info from this URL'
      });
    }
  });
});

// ─── GET PLAYLIST INFO ───
app.post('/api/playlist-info', devOnly, (req, res) => {
  if (!rateLimit(req.ip, 10)) return res.status(429).json({ error: 'Too many requests. Please wait.' });
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  if (!validateUrl(url)) return res.status(400).json({ error: 'Invalid URL' });

  const args = [
    ...COOKIE_ARGS,
    '--dump-json',
    '--no-download',
    '--no-warnings',
    '--flat-playlist',
    url
  ];

  const proc = withTimeout(spawn(YT_DLP_BIN, args), 120000);
  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', d => stdout += d);
  proc.stderr.on('data', d => stderr += d);

  proc.on('close', code => {
    if (code !== 0) {
      return res.status(500).json({ error: 'Failed to fetch playlist info' });
    }
    try {
      const lines = stdout.trim().split('\n');
      const videos = lines.map((line, i) => {
        const info = JSON.parse(line);
        return {
          index: i,
          title: info.title || `Video ${i + 1}`,
          duration: info.duration_string || formatDuration(info.duration),
          url: info.url || info.webpage_url || info.original_url || '',
          thumbnail: info.thumbnail || '',
          id: info.id || ''
        };
      });

      res.json({
        playlist_title: videos[0]?.playlist_title || 'Playlist',
        count: videos.length,
        videos
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse playlist info' });
    }
  });
});

// ─── START DOWNLOAD ───
app.post('/api/download', devOnly, (req, res) => {
  if (!rateLimit(req.ip, 10)) return res.status(429).json({ error: 'Too many downloads. Please wait.' });
  const { url, format = 'mp4', quality = '1080' } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  if (!validateUrl(url)) return res.status(400).json({ error: 'Invalid URL' });

  // Cap concurrent downloads
  const activeCount = [...activeDownloads.values()].filter(d => d.status === 'downloading').length;
  if (activeCount >= MAX_CONCURRENT) return res.status(503).json({ error: 'Too many concurrent downloads. Please wait for one to finish.' });

  const id = crypto.randomUUID();
  const useFallbackDirect = shouldUseFallback(url);

  const dlInfo = {
    id, url, format, quality,
    status: 'downloading',
    progress: 0, speed: '', eta: '', filename: '', totalSize: '', downloaded: '',
    proc: null
  };
  activeDownloads.set(id, dlInfo);

  const fallbackDownload = async () => {
    try {
      const result = await extractAndDownload(url, DOWNLOAD_DIR, (p) => {
        dlInfo.progress = p.progress || 0;
        dlInfo.filename = p.filename || dlInfo.filename;
        if (p.speed) dlInfo.speed = (p.speed / 1024 / 1024).toFixed(1) + ' MB/s';
        if (p.totalSize) dlInfo.totalSize = (p.totalSize / 1024 / 1024).toFixed(1) + ' MB';
        if (p.eta) dlInfo.eta = p.eta + 's';
      });
      dlInfo.status = 'completed'; dlInfo._doneAt = Date.now();
      dlInfo.progress = 100;
      dlInfo.filename = result.filepath || result.filename;
      console.log(`[fallback] Success: ${result.filename} (${(result.size / 1024 / 1024).toFixed(1)} MB)`);
    } catch (fallbackErr) {
      dlInfo.status = 'error'; dlInfo._doneAt = Date.now();
      dlInfo.error = 'Download failed';
      console.log(`[fallback] Failed: ${fallbackErr.message}`);
    }
  };

  if (useFallbackDirect) {
    // Skip yt-dlp, go straight to fallback
    console.log(`[download] Using fallback directly for ${url}`);
    dlInfo.eta = 'Downloading (direct)...';
    fallbackDownload();
  } else {
    // Try yt-dlp first
    const args = [...COOKIE_ARGS, '--no-warnings', '--newline', '--progress'];
    const isAudioOnly = ['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(format);

    if (isAudioOnly) {
      args.push('-x', '--audio-format', format, '--audio-quality', '0');
    } else {
      const heightMap = { '4k': 2160, '1080': 1080, '720': 720, '480': 480, '360': 360 };
      const maxHeight = heightMap[quality] || 1080;
      args.push(
        '-f', `bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]/best`,
        '--merge-output-format', format
      );
    }

    args.push('-o', path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s'), url);
    const proc = spawn(YT_DLP_BIN, args);
    dlInfo.proc = proc;
    let stderrBuf = '';

    proc.stdout.on('data', data => {
      const text = data.toString();
      const progressMatch = text.match(/\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\S+)\s+at\s+([\d.]+\S+)\s+ETA\s+(\S+)/);
      if (progressMatch) {
        dlInfo.progress = parseFloat(progressMatch[1]);
        dlInfo.totalSize = progressMatch[2];
        dlInfo.speed = progressMatch[3];
        dlInfo.eta = progressMatch[4];
      }
      const destMatch = text.match(/\[(?:download|Merger|ExtractAudio)\]\s+Destination:\s+(.+)/);
      if (destMatch) dlInfo.filename = destMatch[1].trim();
      const mergeMatch = text.match(/\[Merger\]\s+Merging formats into "(.+)"/);
      if (mergeMatch) dlInfo.filename = mergeMatch[1].trim();
      if (text.includes('has already been downloaded')) {
        dlInfo.progress = 100;
        dlInfo.status = 'completed'; dlInfo._doneAt = Date.now();
      }
    });

    proc.stderr.on('data', data => { stderrBuf += data.toString(); });

    proc.on('close', async (code) => {
      if (code === 0) {
        dlInfo.status = 'completed'; dlInfo._doneAt = Date.now();
        dlInfo.progress = 100;
      } else {
        console.log(`[fallback] yt-dlp failed for ${url}, trying stream extraction...`);
        dlInfo.status = 'downloading';
        dlInfo.progress = 5;
        dlInfo.speed = '';
        dlInfo.eta = 'Trying fallback...';
        dlInfo.error = '';
        await fallbackDownload();
      }
    });
  }

  res.json({ id, status: 'started' });
});

// ─── DOWNLOAD STATUS ───
app.get('/api/status/:id', devOnly, (req, res) => {
  const id = req.params.id;
  const dl = activeDownloads.get(id);
  if (!dl) return res.status(404).json({ error: 'Download not found' });

  res.json({
    id: dl.id,
    status: dl.status,
    progress: dl.progress,
    speed: dl.speed,
    eta: dl.eta,
    filename: dl.filename ? path.basename(dl.filename) : '',
    totalSize: dl.totalSize,
    error: dl.error || null
  });
});

// ─── CANCEL DOWNLOAD ───
app.post('/api/cancel/:id', devOnly, (req, res) => {
  const id = req.params.id;
  const dl = activeDownloads.get(id);
  if (!dl) return res.status(404).json({ error: 'Download not found' });

  if (dl.proc && dl.status === 'downloading') {
    dl.proc.kill('SIGTERM');
    dl.status = 'cancelled';
    dl._doneAt = Date.now();
  }
  res.json({ status: 'cancelled' });
});

// ─── LIST DOWNLOADS FOLDER ───
app.get('/api/files', devOnly, async (req, res) => {
  try {
    const entries = await fsPromises.readdir(DOWNLOAD_DIR);
    const mediaFiles = entries.filter(f => /\.(mp4|webm|mkv|avi|mov|mp3|wav|flac|aac|ogg)$/i.test(f));
    const files = await Promise.all(mediaFiles.map(async f => {
      const stat = await fsPromises.stat(path.join(DOWNLOAD_DIR, f));
      return { name: f, size: stat.size, date: stat.mtime };
    }));
    files.sort((a, b) => b.date - a.date);
    res.json(files.slice(0, 50));
  } catch {
    res.json([]);
  }
});

// ─── GET OPEN CHROME TABS ───
app.get('/api/tabs', devOnly, (req, res) => {
  // Use AppleScript to get all open Chrome tab URLs + titles
  const script = `
    set tabList to ""
    tell application "Google Chrome"
      set windowCount to count of windows
      repeat with w from 1 to windowCount
        set tabCount to count of tabs of window w
        repeat with t from 1 to tabCount
          set tabUrl to URL of tab t of window w
          set tabTitle to title of tab t of window w
          set tabList to tabList & tabTitle & "|||" & tabUrl & "\\n"
        end repeat
      end repeat
    end tell
    return tabList
  `;

  const proc = spawn('osascript', ['-e', script]);
  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', d => stdout += d);
  proc.stderr.on('data', d => stderr += d);

  proc.on('close', code => {
    if (code !== 0) {
      return res.status(500).json({ error: 'Could not read Chrome tabs' });
    }

    const tabs = stdout.trim().split('\n')
      .filter(line => line.includes('|||'))
      .map(line => {
        const [title, url] = line.split('|||');
        return { title: title.trim(), url: url.trim() };
      })
      .filter(t => t.url && t.url.startsWith('http'));

    // Return all tabs — let the user decide what to download
    res.json(tabs);
  });
});

// ─── GET CHROME HISTORY (video URLs) ───
app.get('/api/history', devOnly, async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const limit = parseInt(req.query.limit) || 200;

  // Chrome locks the DB, so copy it first (async to avoid blocking event loop)
  const historyDb = path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Default/History');
  const tmpDb = path.join(os.tmpdir(), 'tubegrab_history_' + Date.now() + '.db');

  try {
    await fsPromises.copyFile(historyDb, tmpDb);
  } catch (e) {
    return res.status(500).json({ error: 'Cannot read Chrome history database' });
  }

  // Chrome stores time as microseconds since Jan 1, 1601
  const chromeEpoch = 11644473600000000n;
  const cutoffTime = BigInt(Date.now()) * 1000n + chromeEpoch - BigInt(days) * 86400000000n;

  const query = `SELECT url, title, visit_count, last_visit_time FROM urls WHERE last_visit_time > ${cutoffTime} ORDER BY last_visit_time DESC LIMIT ${limit};`;

  const proc = spawn('sqlite3', ['-separator', '|||', tmpDb, query]);
  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', d => stdout += d);
  proc.stderr.on('data', d => stderr += d);

  proc.on('close', code => {
    // Clean up temp file
    try { fs.unlinkSync(tmpDb); } catch {}

    if (code !== 0) {
      return res.status(500).json({ error: 'Failed to query history' });
    }

    const entries = stdout.trim().split('\n')
      .filter(line => line.includes('|||'))
      .map(line => {
        const parts = line.split('|||');
        return {
          url: parts[0],
          title: parts[1] || '',
          visit_count: parseInt(parts[2]) || 1,
          last_visit: parts[3] || ''
        };
      })
      .filter(e => e.url && isVideoUrl(e.url));

    // Deduplicate by URL
    const seen = new Set();
    const unique = entries.filter(e => {
      if (seen.has(e.url)) return false;
      seen.add(e.url);
      return true;
    });

    res.json(unique);
  });
});

// ─── BATCH DOWNLOAD MULTIPLE URLs ───
app.post('/api/batch-download', devOnly, (req, res) => {
  if (!rateLimit(req.ip, 5)) return res.status(429).json({ error: 'Too many batch downloads. Please wait.' });
  const { urls, format = 'mp4', quality = '1080' } = req.body;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs array is required' });
  }
  if (urls.length > 20) return res.status(400).json({ error: 'Maximum 20 URLs per batch' });

  const ids = [];

  for (const entry of urls) {
    const url = typeof entry === 'string' ? entry : entry.url;
    if (!url || !validateUrl(url)) continue;

    const id = crypto.randomUUID();
    ids.push(id);

    const dlInfo = {
      id, url, format, quality,
      status: 'downloading',
      progress: 0, speed: '', eta: '', filename: '', totalSize: '', downloaded: '',
      proc: null
    };
    activeDownloads.set(id, dlInfo);

    // Check if this domain has known yt-dlp issues — skip straight to fallback
    const useFallbackDirect = shouldUseFallback(url);

    if (useFallbackDirect) {
      // Go straight to fallback extractor
      console.log(`[batch] Skipping yt-dlp for ${url}, using fallback directly...`);
      dlInfo.eta = 'Downloading (direct)...';
      (async () => {
        try {
          const result = await extractAndDownload(url, DOWNLOAD_DIR, (p) => {
            dlInfo.progress = p.progress || 0;
            dlInfo.filename = p.filename || dlInfo.filename;
            if (p.speed) dlInfo.speed = (p.speed / 1024 / 1024).toFixed(1) + ' MB/s';
            if (p.totalSize) dlInfo.totalSize = (p.totalSize / 1024 / 1024).toFixed(1) + ' MB';
            if (p.eta) dlInfo.eta = p.eta + 's';
          });
          dlInfo.status = 'completed'; dlInfo._doneAt = Date.now();
          dlInfo.progress = 100;
          dlInfo.filename = result.filepath || result.filename;
          console.log(`[batch] Done: ${result.filename}`);
        } catch (err) {
          dlInfo.status = 'error'; dlInfo._doneAt = Date.now();
          dlInfo.error = 'Download failed';
        }
      })();
    } else {
      // Try yt-dlp first, then fallback
      const args = [...COOKIE_ARGS, '--no-warnings', '--newline', '--progress'];
      const isAudioOnly = ['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(format);

      if (isAudioOnly) {
        args.push('-x', '--audio-format', format, '--audio-quality', '0');
      } else {
        const heightMap = { '4k': 2160, '1080': 1080, '720': 720, '480': 480, '360': 360 };
        const maxHeight = heightMap[quality] || 1080;
        args.push(
          '-f', `bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]/best`,
          '--merge-output-format', format
        );
      }

      args.push('-o', path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s'), url);

      const proc = spawn(YT_DLP_BIN, args);
      dlInfo.proc = proc;
      let stderrBuf = '';

      proc.stdout.on('data', data => {
        const text = data.toString();
        const progressMatch = text.match(/\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\S+)\s+at\s+([\d.]+\S+)\s+ETA\s+(\S+)/);
        if (progressMatch) {
          dlInfo.progress = parseFloat(progressMatch[1]);
          dlInfo.totalSize = progressMatch[2];
          dlInfo.speed = progressMatch[3];
          dlInfo.eta = progressMatch[4];
        }
        const destMatch = text.match(/\[(?:download|Merger|ExtractAudio)\]\s+Destination:\s+(.+)/);
        if (destMatch) dlInfo.filename = destMatch[1].trim();
        const mergeMatch = text.match(/\[Merger\]\s+Merging formats into "(.+)"/);
        if (mergeMatch) dlInfo.filename = mergeMatch[1].trim();
        if (text.includes('has already been downloaded')) {
          dlInfo.progress = 100;
          dlInfo.status = 'completed'; dlInfo._doneAt = Date.now();
        }
      });

      proc.stderr.on('data', data => { stderrBuf += data.toString(); });

      proc.on('close', async (code) => {
        if (code === 0) {
          dlInfo.status = 'completed'; dlInfo._doneAt = Date.now();
          dlInfo.progress = 100;
        } else {
          // Fallback
          console.log(`[batch-fallback] yt-dlp failed for ${url}, trying fallback...`);
          dlInfo.progress = 5;
          dlInfo.eta = 'Trying fallback...';
          dlInfo.error = '';
          try {
            const result = await extractAndDownload(url, DOWNLOAD_DIR, (p) => {
              dlInfo.progress = p.progress || 0;
              dlInfo.filename = p.filename || dlInfo.filename;
              if (p.speed) dlInfo.speed = (p.speed / 1024 / 1024).toFixed(1) + ' MB/s';
              if (p.totalSize) dlInfo.totalSize = (p.totalSize / 1024 / 1024).toFixed(1) + ' MB';
              if (p.eta) dlInfo.eta = p.eta + 's';
            });
            dlInfo.status = 'completed'; dlInfo._doneAt = Date.now();
            dlInfo.progress = 100;
            dlInfo.filename = result.filepath || result.filename;
          } catch (err) {
            dlInfo.status = 'error'; dlInfo._doneAt = Date.now();
            dlInfo.error = 'Download failed';
          }
        }
      });
    }
  }

  res.json({ ids, count: ids.length, status: 'batch_started' });
});

// ─── GET ALL ACTIVE DOWNLOAD STATUSES ───
app.get('/api/status-all', devOnly, (req, res) => {
  const statuses = [];
  for (const [id, dl] of activeDownloads) {
    statuses.push({
      id: dl.id,
      url: dl.url,
      status: dl.status,
      progress: dl.progress,
      speed: dl.speed,
      eta: dl.eta,
      filename: dl.filename ? path.basename(dl.filename) : '',
      totalSize: dl.totalSize,
      error: dl.error || null
    });
  }
  res.json(statuses.reverse());
});

// ─── HELPER: should we skip yt-dlp and use fallback directly? ───
function shouldUseFallback(url) {
  const fallbackDomains = [
    'xhamster.com',
    'xvideos.com',
    'eporner.com',
    'spankbang.com',
    'tube8.com',
    'xnxx.com',
    'redtube.com',
    'youporn.com',
  ];
  try {
    const hostname = new URL(url).hostname.replace('www.', '').replace('m.', '');
    return fallbackDomains.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

// ─── HELPER: is this a video platform URL? ───
function isVideoUrl(url) {
  const videoDomains = [
    'youtube.com', 'youtu.be', 'youtube-nocookie.com',
    'instagram.com',
    'tiktok.com',
    'twitter.com', 'x.com',
    'facebook.com', 'fb.watch', 'fb.com',
    'vimeo.com',
    'dailymotion.com',
    'twitch.tv',
    'reddit.com',
    'streamable.com',
    'rumble.com',
    'bitchute.com',
    'odysee.com',
    'bilibili.com',
    'nicovideo.jp',
    'soundcloud.com',
    'bandcamp.com',
    'mixcloud.com',
    'xhamster.com',
    'pornhub.com',
    'xvideos.com',
    'redtube.com',
    'spankbang.com',
    'eporner.com',
    'tube8.com',
    'xnxx.com',
    'youporn.com',
    'erome.com',
  ];

  try {
    const hostname = new URL(url).hostname.replace('www.', '').replace('m.', '');
    return videoDomains.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

// ─── HELPERS ───
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatViews(count) {
  if (!count) return '';
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M views';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K views';
  return count + ' views';
}

// ─── GOOGLE OAUTH ───
// Set GOOGLE_CLIENT_ID env var to enable Google sign-in
app.get('/api/auth/config', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.json({ enabled: false });
  }
  res.json({ enabled: true, clientId });
});

app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing credential' });

  try {
    // Verify the ID token with Google's tokeninfo endpoint.
    // v3.51.57 (OAuth audit R3): the tokeninfo REST endpoint is throttle-prone
    // and a transient network blip used to surface as a 500 → intermittent
    // login failures ("acting suspect"). Hardened with a 6s AbortController
    // timeout + one retry on network/5xx. (A 4xx is a real invalid token —
    // not retried.) Local google-auth-library verification is the longer-term
    // fix but isn't an explicit dependency; this removes the flakiness without
    // adding one.
    const verifyOnce = async () => {
      const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 6000) : null;
      try {
        return await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
          ctrl ? { signal: ctrl.signal } : {}
        );
      } finally {
        if (timer) clearTimeout(timer);
      }
    };
    let tokenRes;
    try {
      tokenRes = await verifyOnce();
      if (tokenRes.status >= 500) throw new Error('tokeninfo ' + tokenRes.status);
    } catch (netErr) {
      // Network error / timeout / 5xx → one retry before giving up.
      console.warn('[google-auth] tokeninfo retry after:', netErr.message);
      tokenRes = await verifyOnce();
    }
    if (!tokenRes.ok) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }
    const payload = await tokenRes.json();

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (payload.aud !== clientId) {
      return res.status(401).json({ error: 'Token audience mismatch' });
    }
    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
      return res.status(401).json({ error: 'Token issuer mismatch' });
    }

    // Return verified user info + session tokens
    const token = generateToken(payload.sub);
    // Also sign a JWT if JWT_SECRET is configured (for seba-story-api cross-service auth)
    let jwtToken = null;
    if (process.env.JWT_SECRET) {
      try {
        // v3.51.x — carry the Google-verified email + verified flag in the JWT
        // so seba-api can auto-capture parent_email server-side (backfills users
        // whose row has no email). tokeninfo returns email_verified as the
        // string "true"; normalize to 1/0 (Coach C2).
        const _ev = (payload.email_verified === true || payload.email_verified === 'true') ? 1 : 0;
        jwtToken = jwt.sign({ googleId: payload.sub, email: payload.email || null, ev: _ev, tv: 0 }, process.env.JWT_SECRET, { expiresIn: '7d' });
      } catch (e) {
        console.warn('[JWT] Signing failed:', e.message);
      }
    }
    res.json({
      googleId: payload.sub,
      name: payload.name || payload.given_name || '',
      email: payload.email || '',
      picture: payload.picture || '',
      verified: true,
      token,
      ...(jwtToken ? { jwt: jwtToken } : {})
    });
  } catch (e) {
    console.error('[google-auth] Verification failed:', e.message);
    res.status(500).json({ error: 'Auth verification failed' });
  }
});

// Refresh JWT for returning users who have a valid HMAC token but no JWT
app.post('/api/auth/refresh-jwt', (req, res) => {
  const { token, googleId } = req.body;
  if (!token || !googleId) return res.status(400).json({ error: 'Token and googleId required' });
  const verified = verifyToken(token);
  if (!verified) return res.status(401).json({ error: 'Invalid token' });
  if (verified.uid !== googleId) return res.status(401).json({ error: 'Token mismatch' });
  if (!process.env.JWT_SECRET) return res.json({ jwt: null });
  try {
    const jwtToken = jwt.sign({ googleId, tv: 0 }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ jwt: jwtToken });
  } catch (e) {
    res.status(500).json({ error: 'JWT generation failed' });
  }
});

// ─── AUTH SHARED ───
const AUTH_DIR = path.join(__dirname, '.auth-data');
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

// v3.46.5 (2026-05-15) — Cross-process consistency check on register.
// The Consistency-Coach 2nd-eyes audit found a CRITICAL split-brain: the
// .auth-data/<email>.json store (owned by this process) is checked for
// uniqueness on /api/auth/register, but users.db (owned by seba-api,
// where Google-OAuth parents live) was NEVER consulted. Demonstrated live
// by squatting King household's email in 41 seconds via curl.
//
// Fix: open users.db in read-only mode and consult parent_email on every
// register. SQLite WAL allows safe concurrent reads from a second process.
// Read-only mode (SQLITE_OPEN_READONLY) means a future schema migration
// run by seba-api cannot conflict with this handle.
const USERS_DB_PATH = process.env.SEBA_DB_PATH || path.join(__dirname, 'data', 'users.db');
let _usersDbStmtParentEmail = null;
try {
  const Database = require('better-sqlite3');
  // readonly:true + fileMustExist:true — if users.db isn't there, log + skip
  // (the dev environment may not have it). In production it always exists.
  if (fs.existsSync(USERS_DB_PATH)) {
    const usersDb = new Database(USERS_DB_PATH, { readonly: true, fileMustExist: true });
    _usersDbStmtParentEmail = usersDb.prepare(
      'SELECT id, google_id FROM users WHERE LOWER(parent_email) = LOWER(?) LIMIT 1'
    );
    console.log('[AUTH] users.db consistency check enabled at', USERS_DB_PATH);
  } else {
    console.warn('[AUTH] users.db not found at', USERS_DB_PATH, '— cross-process register check DISABLED (dev only)');
  }
} catch (e) {
  console.error('[AUTH] users.db open failed (cross-process register check DISABLED):', e.message);
}
function _existingUsersDbRow(email) {
  if (!_usersDbStmtParentEmail) return null;
  try { return _usersDbStmtParentEmail.get(email) || null; }
  catch (e) { console.error('[AUTH] users.db parent_email lookup failed:', e.message); return null; }
}

// Session token — HMAC-signed userId, verified on protected endpoints
// IMPORTANT: Set AUTH_SECRET in .env for stable sessions across restarts
const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.AUTH_SECRET) console.warn('  ⚠  AUTH_SECRET not set — tokens will invalidate on restart. Add to .env');
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
function generateToken(userId) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  return payload + '.' + sig;
}
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    // Expire tokens after TOKEN_MAX_AGE
    if (decoded.iat && (Date.now() - decoded.iat) > TOKEN_MAX_AGE) return null;
    return decoded;
  } catch { return null; }
}
function requireAuth(req, res) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) { res.status(401).json({ error: 'Authentication required' }); return null; }
  const decoded = verifyToken(auth.slice(7));
  if (!decoded) { res.status(401).json({ error: 'Invalid or expired token' }); return null; }
  return decoded;
}

// Rate limiting — per-IP counters
const _rateLimits = new Map();
function rateLimit(ip, maxPerMinute) {
  const now = Date.now();
  const key = ip;
  if (!_rateLimits.has(key)) _rateLimits.set(key, []);
  const attempts = _rateLimits.get(key).filter(t => now - t < 60000);
  _rateLimits.set(key, attempts);
  if (attempts.length >= maxPerMinute) return false;
  attempts.push(now);
  return true;
}
// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of _rateLimits) {
    const active = times.filter(t => now - t < 60000);
    if (active.length === 0) _rateLimits.delete(key);
    else _rateLimits.set(key, active);
  }
}, 300000);

// ─── EMAIL/PASSWORD AUTH ───

// Use async scrypt to avoid blocking event loop.
// Explicit scrypt params (OWASP 2026 for interactive auth): N=2^17, r=8, p=1.
// Legacy hashes (userData.version !== 2) use Node's default params (N=16384)
// and opportunistically upgrade on next successful login. Matches the PIN
// side's 's2:' prefix scheme — same rationale, different storage shape.
const SCRYPT_V2_OPTS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

// Per-email login-fail lockout. Persistent across restarts (stored in the
// user's auth JSON), so an attacker can't drain the counter by triggering a
// PM2 restart. Liberal window — legit users may fat-finger several times in a
// row. Limit is HIGHER than the per-IP rate-limit because this one is scoped
// to a real account (higher-confidence signal).
const LOGIN_FAIL_LIMIT = Number(process.env.LOGIN_FAIL_LIMIT || 10);
const LOGIN_FAIL_WINDOW_MS = Number(process.env.LOGIN_FAIL_WINDOW_MS || 15 * 60 * 1000);

function recentLoginFailures(userData) {
  if (!Array.isArray(userData.failedLogins)) return [];
  const cutoff = Date.now() - LOGIN_FAIL_WINDOW_MS;
  return userData.failedLogins.filter(t => typeof t === 'number' && t > cutoff);
}

// ─── G5 (2026-05-15) — [AUTH-FUNNEL] 6h digest rollup ───
// Mirrors the seba-story-api.mjs GUARD-DIGEST pattern. Every AUTH-FUNNEL
// emit site also increments an event|reason counter; once per 6h we log a
// single [AUTH-FUNNEL-DIGEST] line with totals + breakdown so on-call can
// see register/login/forgot/reset volume + failure modes at a glance
// without grepping individual events. Empty windows produce no log.
const authFunnelCounter = {
  events: new Map(), // key: event|reason (reason='' if absent), value: count
  windowStartedAt: Date.now(),
};
function recordAuthFunnelEvent(event, reason) {
  const k = (event || 'unknown') + '|' + (reason || '');
  authFunnelCounter.events.set(k, (authFunnelCounter.events.get(k) || 0) + 1);
}
const AUTH_FUNNEL_DIGEST_MS = 6 * 60 * 60 * 1000;
// Tuned threshold: a sustained run of 50 failures in 6h on a single event
// (e.g., 50 reset_password_token_invalid) is a probable enumeration scan.
const AUTH_FUNNEL_WARN_THRESHOLD = 50;
// v3.46.5 — Consistency-Coach Low fix: extracted to a named function so the
// 6h interval AND the SIGTERM/SIGINT shutdown handlers can share the emit
// path. Without the shutdown flush, a pm2 reload before the 6h window ends
// loses the accumulated counts — exactly what's happened so far (the digest
// has never emitted in production because both processes restart frequently).
function flushAuthFunnelDigest(reason) {
  const entries = [...authFunnelCounter.events.entries()];
  if (entries.length === 0) {
    authFunnelCounter.windowStartedAt = Date.now();
    return;
  }
  const total = entries.reduce((a, [, n]) => a + n, 0);
  const breakdown = entries.sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}=${n}`).join(' ');
  const maxSingle = entries.reduce((a, [, n]) => Math.max(a, n), 0);
  const level = maxSingle >= AUTH_FUNNEL_WARN_THRESHOLD ? 'WARN' : 'INFO';
  console.log('[AUTH-FUNNEL-DIGEST] ' + JSON.stringify({
    schema: 'v1', level, source: 'server',
    window_started_at: authFunnelCounter.windowStartedAt,
    window_ended_at: Date.now(),
    flush_reason: reason || 'interval',
    total,
    by_event_reason: breakdown,
  }));
  authFunnelCounter.events.clear();
  authFunnelCounter.windowStartedAt = Date.now();
}
setInterval(() => flushAuthFunnelDigest('interval'), AUTH_FUNNEL_DIGEST_MS).unref?.();
// On graceful shutdown (pm2 reload sends SIGINT then SIGTERM), flush so the
// in-flight window's counts make it to the log before the process exits.
process.on('SIGTERM', () => { try { flushAuthFunnelDigest('sigterm'); } catch (_) {} });
process.on('SIGINT',  () => { try { flushAuthFunnelDigest('sigint'); } catch (_) {} });

function hashPasswordAsync(password, salt, version = 2) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const opts = version === 2 ? SCRYPT_V2_OPTS : {};
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, opts, (err, key) => {
      if (err) return reject(err);
      resolve({ salt, hash: key.toString('hex'), version });
    });
  });
}

app.post('/api/auth/register', async (req, res) => {
  if (!rateLimit(req.ip, 5)) return res.status(429).json({ error: 'Too many attempts. Please wait a minute.' });
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'All fields are required' });
  // NIST SP 800-63B rev 4: length beats composition. A 12-char passphrase
  // ("correct horse battery staple") outperforms the old 8-char + uppercase
  // + digit rule, because composition pushes users toward predictable
  // patterns like Password1. No uppercase/digit requirement.
  if (password.length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters' });
  if (password.length > 128) return res.status(400).json({ error: 'Password must be 128 characters or fewer' });

  const normalized = email.toLowerCase().trim();
  const safeEmail = normalized.replace(/[^a-z0-9@._-]/g, '');
  // v3.51.76 S2 — reject emails that contain strippable characters instead
  // of silently registering them under the stripped form. Before:
  // `john+kid@example.com` registered as `johnkid@example.com` — a different
  // account than the visitor thought they created, with confusing recovery.
  if (safeEmail !== normalized) {
    recordAuthFunnelEvent('register_failed', 'email_unsupported_chars');
    return res.status(400).json({ error: 'Email contains unsupported characters (e.g. + or spaces). Please use a simpler form like name@example.com.' });
  }
  // v3.51.76 S3 — cap name length defensively. Client maxlength=20 is a
  // hint, not a contract; without a server cap an attacker could push a
  // 10KB display name into the user_data blob.
  const safeName = String(name || '').trim().slice(0, 40);
  if (!safeName) return res.status(400).json({ error: 'Please enter your first name.' });
  const authFile = path.join(AUTH_DIR, safeEmail.replace(/[^a-z0-9]/g, '_') + '.json');

  // v3.46.5 — Consistency-Coach Critical fix: cross-process check against
  // users.db. A Google-OAuth-registered parent (most of the user base) has
  // NO .auth-data row; without this check, anyone can POST register for
  // their email and squat a password account. Reproduced live during the
  // 2026-05-15 audit on the King household (id 110) in 41 seconds.
  const existingDbRow = _existingUsersDbRow(safeEmail);
  if (existingDbRow) {
    recordAuthFunnelEvent('register_failed', 'account_exists_oauth');
    return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
  }

  try {
    await fsPromises.access(authFile);
    recordAuthFunnelEvent('register_failed', 'account_exists');
    return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
  } catch { /* file doesn't exist — good */ }

  try {
    const { salt, hash, version } = await hashPasswordAsync(password);
    const userId = 'email_' + crypto.randomBytes(8).toString('hex');
    const userData = { userId, email: safeEmail, name: safeName, salt, hash, version, createdAt: Date.now() };
    // v3.46.5 — Consistency-Coach Medium fix: atomic write via 'wx' flag
    // (create-or-fail). Closes the TOCTOU window between fs.access and
    // writeFile that could let two parallel registers both succeed.
    await fsPromises.writeFile(authFile, JSON.stringify(userData, null, 2), { flag: 'wx' });
    const token = generateToken(userId);
    let jwtToken = null;
    if (process.env.JWT_SECRET) {
      try { jwtToken = jwt.sign({ googleId: userId, tv: 0 }, process.env.JWT_SECRET, { expiresIn: '7d' }); }
      catch (e) { console.warn('[JWT] Signing failed:', e.message); }
    }
    recordAuthFunnelEvent('register_ok');
    res.json({ userId, name: userData.name, email: safeEmail, token, ...(jwtToken ? { jwt: jwtToken } : {}) });
  } catch (e) {
    // EEXIST = the atomic write lost a race with another register attempt.
    // Surface as account_exists rather than server_error so the client sees
    // the same 409 + can route to the G8 action row.
    if (e && e.code === 'EEXIST') {
      recordAuthFunnelEvent('register_failed', 'account_exists_race');
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    }
    recordAuthFunnelEvent('register_failed', 'server_error');
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  if (!rateLimit(req.ip, 10)) return res.status(429).json({ error: 'Too many attempts. Please wait a minute.' });
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const safeEmail = email.toLowerCase().trim().replace(/[^a-z0-9@._-]/g, '');
  const authFile = path.join(AUTH_DIR, safeEmail.replace(/[^a-z0-9]/g, '_') + '.json');

  try {
    const raw = await fsPromises.readFile(authFile, 'utf-8');
    const userData = JSON.parse(raw);

    // Per-email lockout (persistent). Checked BEFORE password verify so we
    // don't leak timing signal via scrypt on a locked account. Window is
    // sliding — old failures age out naturally.
    const recent = recentLoginFailures(userData);
    if (recent.length >= LOGIN_FAIL_LIMIT) {
      // v3.46.5 — Consistency-Coach Low fix: reduce() instead of
      // Math.min(...spread), which throws RangeError at ~100k elements.
      // Defensive only — LOGIN_FAIL_LIMIT is 10 — but cheap.
      const oldestRecent = recent.reduce((m, t) => t < m ? t : m, recent[0]);
      const retryAfterSec = Math.max(1, Math.ceil((oldestRecent + LOGIN_FAIL_WINDOW_MS - Date.now()) / 1000));
      res.set('Retry-After', String(retryAfterSec));
      recordAuthFunnelEvent('login_failed', 'locked');
      return res.status(429).json({
        error: 'Account temporarily locked after too many failed attempts. Try again later or reset your password.',
        code: 'LOGIN_LOCKED',
        retryAfterSec
      });
    }

    const storedVersion = userData.version === 2 ? 2 : 1;
    const { hash } = await hashPasswordAsync(password, userData.salt, storedVersion);
    if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(userData.hash, 'hex'))) {
      // Record the failure so repeated misses trip the lockout above.
      // Best-effort write — if disk fails, login still rejects with 401.
      setImmediate(async () => {
        try {
          const fresh = JSON.parse(await fsPromises.readFile(authFile, 'utf-8'));
          const kept = recentLoginFailures(fresh);
          kept.push(Date.now());
          fresh.failedLogins = kept;
          await fsPromises.writeFile(authFile, JSON.stringify(fresh, null, 2));
        } catch (_) { /* non-fatal */ }
      });
      recordAuthFunnelEvent('login_failed', 'invalid_password');
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    // Opportunistic upgrade to v2 scrypt params + clear failure counter on
    // success. Both happen *after* the response so login isn't gated on disk.
    if (storedVersion !== 2 || (userData.failedLogins && userData.failedLogins.length)) {
      setImmediate(async () => {
        try {
          const fresh = JSON.parse(await fsPromises.readFile(authFile, 'utf-8'));
          let changed = false;
          if (storedVersion !== 2) {
            const upgraded = await hashPasswordAsync(password, null, 2);
            fresh.salt = upgraded.salt;
            fresh.hash = upgraded.hash;
            fresh.version = 2;
            changed = true;
          }
          if (fresh.failedLogins && fresh.failedLogins.length) {
            fresh.failedLogins = [];
            changed = true;
          }
          if (changed) await fsPromises.writeFile(authFile, JSON.stringify(fresh, null, 2));
        } catch (_) { /* upgrade is best-effort */ }
      });
    }
    const token = generateToken(userData.userId);
    let jwtToken = null;
    if (process.env.JWT_SECRET) {
      try { jwtToken = jwt.sign({ googleId: userData.userId, tv: 0 }, process.env.JWT_SECRET, { expiresIn: '7d' }); }
      catch (e) { console.warn('[JWT] Signing failed:', e.message); }
    }
    recordAuthFunnelEvent('login_ok');
    res.json({ userId: userData.userId, name: userData.name, email: userData.email, token, ...(jwtToken ? { jwt: jwtToken } : {}) });
  } catch (e) {
    if (e.code === 'ENOENT') {
      // v3.51.75 S1 — disambiguate "no account" from "wrong-channel". If
      // the email is registered via Google OAuth (no password file), the
      // visitor was getting the dead-end "Invalid email or password" with
      // no idea their account exists at all. Surface USE_GOOGLE so the
      // client renders a specific "this email is registered with Google"
      // hint pointing at the Google button above.
      //
      // Privacy note: this leaks "the email has a Google account here" to
      // anyone who tries it. The /api/auth/register path already 409s on
      // the same condition, so enumeration is not newly exposed — the
      // register endpoint has been emitting this signal since v3.46.5.
      // The benefit (rescuing stuck legitimate users) clearly outweighs
      // the marginal privacy cost.
      try {
        if (_existingUsersDbRow && _existingUsersDbRow(safeEmail)) {
          recordAuthFunnelEvent('login_failed', 'use_google');
          return res.status(401).json({
            error: 'This email is registered with Google. Use "Sign in with Google" above.',
            code: 'USE_GOOGLE'
          });
        }
      } catch (_) { /* helper unavailable in dev — fall through to generic */ }
      recordAuthFunnelEvent('login_failed', 'no_account');
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    recordAuthFunnelEvent('login_failed', 'server_error');
    res.status(500).json({ error: 'Authentication error' });
  }
});

// ─── G1 (2026-05-15) — MAGIC-LINK PASSWORD RESET ───
// Closes the audit gap: an email-registered parent who forgets their password
// previously had no recovery path. The 2nd-eyes RT (Parent-Voice + Security)
// rated this Critical for a child-facing app. Pattern mirrors the existing
// HMAC-signed token shape (UNSUB_SECRET / CHUNK_SIGNING_SECRET in
// seba-story-api.mjs and the session-token here at line ~969).

const PWRESET_TTL_MS = 60 * 60 * 1000;  // 1 hour
const PWRESET_PURPOSE = 'pw-reset';

function _safeEmailToFile(email) {
  const safeEmail = email.toLowerCase().trim().replace(/[^a-z0-9@._-]/g, '');
  return { safeEmail, authFile: path.join(AUTH_DIR, safeEmail.replace(/[^a-z0-9]/g, '_') + '.json') };
}

function signPasswordResetToken(uid, safeEmail) {
  const payload = {
    uid: String(uid || ''),
    email: String(safeEmail || ''),
    purpose: PWRESET_PURPOSE,
    iat: Date.now(),
    exp: Date.now() + PWRESET_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}

// Returns { ok: true, payload } on valid, else { ok: false, reason }.
// Uses crypto.timingSafeEqual (mirrors the chunk-token verifier from v3.45.x).
//
// v3.46.5 — Consistency-Coach High fix: single-use enforcement via
// `lastResetAtMs`. The caller passes the user's stored
// userData.lastPasswordResetAt; we reject tokens whose iat is less than or
// equal to that (i.e. a token issued BEFORE the last successful reset).
// NIST SP 800-63B §5.1.3.3 requires reset tokens to be single-use; without
// this guard a stolen reset email could be replayed within the 1h TTL even
// after the legitimate parent already redeemed it.
function verifyPasswordResetToken(token, expectedEmail, lastResetAtMs) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return { ok: false, reason: 'malformed' };
  const [body, sig] = token.split('.');
  if (!body || !sig) return { ok: false, reason: 'malformed' };
  let payloadStr;
  try { payloadStr = Buffer.from(body, 'base64url').toString('utf8'); }
  catch (_) { return { ok: false, reason: 'decode_failed' }; }
  let payload;
  try { payload = JSON.parse(payloadStr); }
  catch (_) { return { ok: false, reason: 'json_parse_failed' }; }
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  let sigMatch = false;
  try {
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    sigMatch = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) { sigMatch = false; }
  if (!sigMatch) return { ok: false, reason: 'sig_mismatch' };
  if (payload.purpose !== PWRESET_PURPOSE) return { ok: false, reason: 'purpose_mismatch' };
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return { ok: false, reason: 'expired' };
  if (expectedEmail && payload.email !== expectedEmail) return { ok: false, reason: 'email_mismatch' };
  // Single-use: token's iat must be NEWER than any prior reset on this user.
  // The 1h TTL alone is not enough — a replay within the window is trivial.
  if (typeof lastResetAtMs === 'number' && lastResetAtMs > 0 && typeof payload.iat === 'number' && payload.iat <= lastResetAtMs) {
    return { ok: false, reason: 'already_redeemed' };
  }
  return { ok: true, payload };
}

function _publicAppUrl(req) {
  if (process.env.PUBLIC_APP_URL) return process.env.PUBLIC_APP_URL.replace(/\/+$/, '');
  const host = req.get('host') || 'localhost:3456';
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  return proto + '://' + host;
}

// POST /api/auth/forgot-password — send a 1-hour magic-link to the registered
// email if (and only if) an account exists at that address. **Always returns
// 200 sent:true** to avoid account-enumeration leakage; the actual outcome is
// in the structured [AUTH-FUNNEL] log.
app.post('/api/auth/forgot-password', async (req, res) => {
  if (!rateLimit(req.ip, 3)) {
    return res.status(429).json({ error: 'Too many attempts. Please wait a minute.' });
  }
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  const { safeEmail, authFile } = _safeEmailToFile(email);
  const emailHash = crypto.createHash('sha256').update(safeEmail).digest('hex').slice(0, 16);

  let userData = null;
  try {
    userData = JSON.parse(await fsPromises.readFile(authFile, 'utf-8'));
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('[AUTH-FUNNEL] forgot-password readFile error:', e.message);
  }

  if (!userData) {
    // No account — silent no-op (anti-enumeration). Log the no-op for telemetry.
    recordAuthFunnelEvent('forgot_password_no_account');
    console.log('[AUTH-FUNNEL] ' + JSON.stringify({
      schema: 'v1', event: 'forgot_password_no_account', email_hash: emailHash, ts: Date.now()
    }));
    return res.json({ sent: true });  // intentional 200 sent:true
  }

  // Configured SendGrid required to send. Without it: 502 (vs. the silent
  // no-account branch above which always 200s).
  if (!process.env.SENDGRID_API_KEY) {
    recordAuthFunnelEvent('forgot_password_send_failed', 'sendgrid_not_configured');
    console.error('[AUTH-FUNNEL] ' + JSON.stringify({
      schema: 'v1', event: 'forgot_password_send_failed', reason: 'sendgrid_not_configured',
      email_hash: emailHash, ts: Date.now()
    }));
    return res.status(502).json({ sent: false, reason: 'sendgrid_not_configured', error: 'Email service is not configured. Please contact seba@osiriscare.net.' });
  }

  const token = signPasswordResetToken(userData.userId, safeEmail);
  const url = _publicAppUrl(req) + '/?reset=' + encodeURIComponent(token);
  const msg = {
    to: safeEmail,
    from: { name: 'Seba Khafre — Per Ankh', email: SEBA_FROM_EMAIL },
    subject: 'Seba Khafre — Reset your password',
    html: `<div style="font-family:Georgia,serif;max-width:500px;margin:0 auto;background:#110D08;color:#F2E4CC;padding:32px;border-radius:12px;">
      <h2 style="color:#C4A347;text-align:center;margin:0 0 16px;font-family:Georgia,serif;">Senebty.</h2>
      <p style="margin:0 0 16px;">A request came to set a new password for this email. Follow this link to choose one:</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${url}" style="display:inline-block;padding:14px 28px;background:#C4A347;color:#110D08;text-decoration:none;font-weight:700;border-radius:8px;">Set a new password</a>
      </p>
      <p style="margin:0 0 12px;">The link expires in one hour. If you did not ask for it, you may ignore this message.</p>
      <p style="color:#888;font-size:0.85em;margin:18px 0 0;">— Seba Khafre, Per Ankh</p>
    </div>`
  };

  try {
    const sendResult = await sgMail.send(msg);
    const sgResponse = Array.isArray(sendResult) ? sendResult[0] : sendResult;
    const sgStatus = sgResponse && sgResponse.statusCode;
    if (typeof sgStatus === 'number' && (sgStatus < 200 || sgStatus >= 300)) {
      recordAuthFunnelEvent('forgot_password_send_failed', 'sendgrid_non2xx');
      console.error('[AUTH-FUNNEL] ' + JSON.stringify({
        schema: 'v1', event: 'forgot_password_send_failed', reason: 'sendgrid_non2xx',
        email_hash: emailHash, sg_status: sgStatus, ts: Date.now()
      }));
      return res.status(502).json({ sent: false, reason: 'sendgrid_non2xx', error: 'Email service did not accept the message. Please try again or contact seba@osiriscare.net.' });
    }
  } catch (sendErr) {
    recordAuthFunnelEvent('forgot_password_send_failed', 'sendgrid_throw');
    console.error('[AUTH-FUNNEL] ' + JSON.stringify({
      schema: 'v1', event: 'forgot_password_send_failed', reason: 'sendgrid_throw',
      email_hash: emailHash,
      sg_error: (sendErr && sendErr.message) ? sendErr.message.slice(0, 200) : String(sendErr).slice(0, 200),
      ts: Date.now()
    }));
    return res.status(502).json({ sent: false, reason: 'sendgrid_send_failed', error: 'Email service refused the message. Please try again or contact seba@osiriscare.net.' });
  }

  recordAuthFunnelEvent('forgot_password_send_ok');
  console.log('[AUTH-FUNNEL] ' + JSON.stringify({
    schema: 'v1', event: 'forgot_password_send_ok', email_hash: emailHash, ts: Date.now()
  }));
  res.json({ sent: true });
});

// POST /api/auth/reset-password — redeem a magic-link token + set a new password.
// On success, returns the same shape as /api/auth/register / /api/auth/login —
// the client logs the user in directly with the new credentials.
app.post('/api/auth/reset-password', async (req, res) => {
  if (!rateLimit(req.ip, 5)) {
    return res.status(429).json({ error: 'Too many attempts. Please wait a minute.' });
  }
  const { token, password } = req.body || {};
  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Missing reset token' });
  if (!password || typeof password !== 'string') return res.status(400).json({ error: 'Password required' });
  if (password.length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters' });
  if (password.length > 128) return res.status(400).json({ error: 'Password must be 128 characters or fewer' });

  // v3.46.5 — single-use enforcement: we need userData.lastPasswordResetAt
  // BEFORE verifying the token (so the verifier can reject already-redeemed
  // tokens). Order is: parse-out-email-from-token → load userData → verify
  // with lastResetAt → success → rotate password + bump lastPasswordResetAt.
  //
  // We do a CHEAP pre-parse to extract the email without trusting it (no
  // sig check yet — that's the verifier's job). If the email is malformed
  // or the file doesn't exist, fall through to the verifier so the response
  // path is consistent + telemetry uniform.
  let preparseEmail = null;
  try {
    const [body0] = String(token).split('.');
    if (body0) {
      const payload0 = JSON.parse(Buffer.from(body0, 'base64url').toString('utf8'));
      if (payload0 && typeof payload0.email === 'string') preparseEmail = payload0.email;
    }
  } catch (_) { /* malformed; verifier will reject */ }

  let preUserData = null;
  if (preparseEmail) {
    const { authFile: preFile } = _safeEmailToFile(preparseEmail);
    try { preUserData = JSON.parse(await fsPromises.readFile(preFile, 'utf-8')); }
    catch (_) { /* file gone; verifier sig check will still run */ }
  }
  const lastResetAtMs = (preUserData && typeof preUserData.lastPasswordResetAt === 'number')
    ? preUserData.lastPasswordResetAt : 0;

  const verify = verifyPasswordResetToken(token, undefined, lastResetAtMs);
  if (!verify.ok) {
    recordAuthFunnelEvent('reset_password_token_invalid', verify.reason);
    console.warn('[AUTH-FUNNEL] ' + JSON.stringify({
      schema: 'v1', event: 'reset_password_token_invalid', reason: verify.reason, ts: Date.now()
    }));
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.', reason: verify.reason });
  }

  const { authFile } = _safeEmailToFile(verify.payload.email);
  let userData;
  try {
    userData = JSON.parse(await fsPromises.readFile(authFile, 'utf-8'));
  } catch (e) {
    // v3.46.5 — Consistency-Coach Low fix: emit AUTH-FUNNEL for telemetry parity.
    recordAuthFunnelEvent('reset_password_token_invalid', 'account_missing');
    console.warn('[AUTH-FUNNEL] ' + JSON.stringify({
      schema: 'v1', event: 'reset_password_token_invalid', reason: 'account_missing',
      email_hash: crypto.createHash('sha256').update(verify.payload.email).digest('hex').slice(0, 16),
      ts: Date.now()
    }));
    return res.status(400).json({ error: 'Account no longer exists.' });
  }

  // Issue new salt + scrypt v2 hash; clear failure counter.
  try {
    const { salt, hash, version } = await hashPasswordAsync(password);
    userData.salt = salt;
    userData.hash = hash;
    userData.version = version;
    userData.failedLogins = [];
    userData.lastPasswordResetAt = Date.now();
    await fsPromises.writeFile(authFile, JSON.stringify(userData, null, 2));
  } catch (e) {
    console.error('[AUTH-FUNNEL] reset-password rehash failed:', e.message);
    return res.status(500).json({ error: 'Could not save new password.' });
  }

  recordAuthFunnelEvent('reset_password_ok');
  console.log('[AUTH-FUNNEL] ' + JSON.stringify({
    schema: 'v1', event: 'reset_password_ok',
    email_hash: crypto.createHash('sha256').update(verify.payload.email).digest('hex').slice(0, 16),
    ts: Date.now()
  }));

  const sessionToken = generateToken(userData.userId);
  let jwtToken = null;
  if (process.env.JWT_SECRET) {
    try { jwtToken = jwt.sign({ googleId: userData.userId, tv: 0 }, process.env.JWT_SECRET, { expiresIn: '7d' }); }
    catch (e) { console.warn('[JWT] Signing failed:', e.message); }
  }
  res.json({
    userId: userData.userId, name: userData.name, email: userData.email,
    token: sessionToken, ...(jwtToken ? { jwt: jwtToken } : {})
  });
});

// (User progress persists exclusively to SQLite via seba-story-api
// /api/seba-sync + /api/seba-user-profile. The legacy file-based
// /api/user/save|load endpoints and the .user-data store were removed
// 2026-05-20 after the single-source-of-truth migration.)

// ─── AZURE SPEECH TOKEN PROXY — MULTI-REGION ───
// Supports multiple Azure Speech regions for global low-latency.
// Set env vars: AZURE_SPEECH_KEY_EASTUS, AZURE_SPEECH_KEY_WESTEUROPE, etc.
// Falls back to AZURE_SPEECH_KEY + AZURE_SPEECH_REGION for single-region setups.

const _azureTokenCaches = {}; // { region: { token, expiry } }

// Map timezone offsets to closest Azure Speech region
const TIMEZONE_REGION_MAP = {
  // Americas
  'America': 'eastus',
  // Europe & Africa
  'Europe': 'westeurope',
  'Africa': 'westeurope',
  // UK & Ireland
  'GB': 'uksouth',
  // Middle East
  'Asia/Dubai': 'uaenorth',
  'Asia/Riyadh': 'uaenorth',
  // India
  'Asia/Kolkata': 'centralindia',
  'Asia/Calcutta': 'centralindia',
  'Asia/Mumbai': 'centralindia',
  // East Asia
  'Asia/Tokyo': 'japaneast',
  'Asia/Seoul': 'japaneast',
  'Asia/Shanghai': 'eastasia',
  'Asia/Hong_Kong': 'eastasia',
  // Southeast Asia
  'Asia/Singapore': 'southeastasia',
  'Asia/Bangkok': 'southeastasia',
  'Asia/Jakarta': 'southeastasia',
  // Australia
  'Australia': 'australiaeast',
  // Pacific
  'Pacific': 'westus2',
};

function getAzureRegionForTimezone(tz) {
  if (!tz) return null;
  // Exact match first
  if (TIMEZONE_REGION_MAP[tz]) return TIMEZONE_REGION_MAP[tz];
  // Prefix match (e.g. "America/New_York" → "America")
  const prefix = tz.split('/')[0];
  if (TIMEZONE_REGION_MAP[prefix]) return TIMEZONE_REGION_MAP[prefix];
  return null;
}

function getAzureKeyForRegion(region) {
  // Try region-specific key first: AZURE_SPEECH_KEY_EASTUS, AZURE_SPEECH_KEY_WESTEUROPE
  const regionKey = process.env[`AZURE_SPEECH_KEY_${region.toUpperCase().replace(/-/g, '_')}`];
  if (regionKey) return { key: regionKey, region };
  // Fall back to default key+region
  const defaultKey = process.env.AZURE_SPEECH_KEY;
  const defaultRegion = process.env.AZURE_SPEECH_REGION || 'eastus';
  if (defaultKey) return { key: defaultKey, region: defaultRegion };
  return null;
}

app.get('/api/speech-token', async (req, res) => {
  // No JWT required — speech is a core reading feature for all users (including unauthenticated kids)
  // Rate-limited by IP to prevent abuse
  if (!rateLimit(req.ip, 5)) return res.status(429).json({ error: 'Too many token requests. Please wait.' });
  // Determine best region from client timezone hint
  const clientTz = req.query.tz || req.headers['x-timezone'] || '';
  const preferredRegion = getAzureRegionForTimezone(clientTz);
  const azure = getAzureKeyForRegion(preferredRegion || 'eastus');

  if (!azure) {
    return res.status(503).json({
      error: 'Azure Speech not configured',
      setup: 'Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (or AZURE_SPEECH_KEY_EASTUS, AZURE_SPEECH_KEY_WESTEUROPE, etc.) environment variables.'
    });
  }

  const { key, region } = azure;

  // Return cached token if still valid
  const cached = _azureTokenCaches[region];
  if (cached && cached.expiry > Date.now()) {
    return res.json({ token: cached.token, region });
  }

  // Issue a fresh token with a 6s timeout (a transient blip used to hang or
  // 500 the request, killing TTS mid-reading). One issueToken attempt:
  const issueToken = async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      return await fetch(
        `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
        { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' }, signal: ctrl.signal }
      );
    } finally { clearTimeout(timer); }
  };

  // Up to 2 attempts: retry once on network failure / timeout / 429 / 5xx.
  // A 4xx (e.g. bad key) is NOT transient — don't hammer Azure, fail fast.
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const tokenRes = await issueToken();
      if (tokenRes.ok) {
        const token = await tokenRes.text();
        _azureTokenCaches[region] = { token, expiry: Date.now() + 8 * 60 * 1000, fetchedAt: Date.now() };
        return res.json({ token, region });
      }
      lastErr = new Error('upstream ' + tokenRes.status);
      if (attempt === 1 && (tokenRes.status === 429 || tokenRes.status >= 500)) continue; // transient
      break; // 4xx — non-retryable
    } catch (e) {
      lastErr = e;
      console.warn(`[speech-token] attempt ${attempt} failed (${region}): ${e.message}`);
      // network error / abort → retry once
    }
  }

  // All attempts failed. Azure tokens are valid ~10 min; our cache "expires"
  // at 8 min, so a token fetched <9 min ago is still usable at Azure. Serve it
  // rather than killing TTS for a kid mid-reading (graceful degradation).
  if (cached && cached.token && (Date.now() - (cached.fetchedAt || 0)) < 9 * 60 * 1000) {
    console.warn(`[speech-token] serving stale-but-valid cached token after refresh failure (${region})`);
    return res.json({ token: cached.token, region, stale: true });
  }
  console.error('[speech-token] all attempts failed:', lastErr && lastErr.message);
  res.status(502).json({ error: 'Speech service temporarily unavailable' });
});

// ═══════════════════════════════════════════════════════════════════
// Heka recognition telemetry — structured client metrics, no transcripts
// ═══════════════════════════════════════════════════════════════════
// POST /api/telemetry/heka — accepts a small JSON blob with recognition
// timing + outcome. Transcripts are never sent or logged. Phase B of the
// Heka responsiveness fix. See docs/superpowers/plans/heka-phase-b.md.
const HEKA_TEL_SCHEMA = 'v1';
const HEKA_ALLOWED_FALLBACK = new Set(['azure', 'webspeech', 'typing']);
const HEKA_ALLOWED_COMPLETION = new Set(['ok', 'timeout', 'error', 'cancelled']);
const HEKA_ALLOWED_UA = new Set(['chrome', 'firefox', 'safari', 'edge', 'other']);
const HEKA_MAX_ID_LEN = 128;
const HEKA_MAX_REGION_LEN = 32;

function hekaClamp(n, lo, hi){
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.max(lo, Math.min(hi, Math.round(x)));
}
function hekaSanitizeId(s){
  if (typeof s !== 'string') return null;
  const trimmed = s.slice(0, HEKA_MAX_ID_LEN);
  // allow alnum, dash, underscore, dot (no transcripts — this is an id/slug field)
  return /^[a-zA-Z0-9_.\-]+$/.test(trimmed) ? trimmed : null;
}
function hekaValidatePayload(raw){
  if (!raw || typeof raw !== 'object') return { ok:false, reason:'not_object' };
  if (raw.schema !== HEKA_TEL_SCHEMA) return { ok:false, reason:'bad_schema' };

  const session_id = hekaSanitizeId(raw.session_id);
  if (!session_id) return { ok:false, reason:'bad_session_id' };
  const story_id = hekaSanitizeId(raw.story_id);
  if (!story_id) return { ok:false, reason:'bad_story_id' };

  const chunk_id = typeof raw.chunk_id === 'number'
    ? hekaClamp(raw.chunk_id, 0, 999)
    : hekaSanitizeId(raw.chunk_id);
  if (chunk_id === null) return { ok:false, reason:'bad_chunk_id' };

  const level = hekaClamp(raw.level, 1, 6);
  if (level === null) return { ok:false, reason:'bad_level' };

  const region = typeof raw.region === 'string'
    ? raw.region.slice(0, HEKA_MAX_REGION_LEN).replace(/[^a-z0-9]/g, '')
    : '';

  const fallback_used = HEKA_ALLOWED_FALLBACK.has(raw.fallback_used) ? raw.fallback_used : null;
  if (!fallback_used) return { ok:false, reason:'bad_fallback_used' };

  const word_count = hekaClamp(raw.word_count, 0, 1000);
  const matched = hekaClamp(raw.matched, 0, 1000);
  if (word_count === null || matched === null) return { ok:false, reason:'bad_counts' };

  const first_interim_ms = raw.first_interim_ms === null || raw.first_interim_ms === undefined
    ? null : hekaClamp(raw.first_interim_ms, 0, 60000);
  const first_confirm_ms = raw.first_confirm_ms === null || raw.first_confirm_ms === undefined
    ? null : hekaClamp(raw.first_confirm_ms, 0, 60000);
  const completed_ms = hekaClamp(raw.completed_ms, 0, 600000);
  if (completed_ms === null) return { ok:false, reason:'bad_completed_ms' };

  const completion = HEKA_ALLOWED_COMPLETION.has(raw.completion) ? raw.completion : null;
  if (!completion) return { ok:false, reason:'bad_completion' };

  const ua_family = HEKA_ALLOWED_UA.has(raw.ua_family) ? raw.ua_family : 'other';
  const reduced_motion = raw.reduced_motion === true;

  return {
    ok: true,
    clean: {
      schema: HEKA_TEL_SCHEMA,
      session_id, story_id, chunk_id, level, region,
      fallback_used, word_count, matched,
      first_interim_ms, first_confirm_ms, completed_ms,
      completion, ua_family, reduced_motion,
    }
  };
}
// A global express.json({limit:'200kb'}) runs before this route, so the
// route-level size limit is enforced by a content-length guard instead of
// a second express.json() middleware (which would be a no-op after parse).
const HEKA_TEL_MAX_BYTES = 4096;
app.post('/api/telemetry/heka', (req, res) => {
  // Feature flag — allow silent disable without client noise
  if (process.env.HEKA_TELEMETRY_DISABLED === '1') return res.status(204).end();

  const cl = Number(req.headers['content-length']);
  if (Number.isFinite(cl) && cl > HEKA_TEL_MAX_BYTES) {
    return res.status(413).json({ error: 'payload_too_large' });
  }

  // Chatty but bounded — one event per Heka moment, ≤ ~30/hr/user in practice
  if (!rateLimit(req.ip, 60)) return res.status(429).json({ error: 'rate_limited' });

  const result = hekaValidatePayload(req.body);
  if (!result.ok) return res.status(400).json({ error: result.reason });

  console.log('[HEKA-TEL]', JSON.stringify(result.clean));
  res.status(204).end();
});

// Phase v3.33.0 — Seba voice telemetry (heka pattern).
// Architecture-gate: docs/superpowers/round-tables/2026-04-28-seba-audio-architecture-gate.md
// Plan: docs/superpowers/plans/2026-04-28-seba-audio-robustness.md
const SEBA_POOLS = new Set([
  'young-mer', 'young-sedjm', 'young-rekh', 'young-celebration', 'young-achievement',
  'elder-sema', 'elder-sema-daily', 'elder-sema-redirect', 'elder-sema-approval'
]);
const SEBA_PERSONAS = new Set(['young', 'elder']);
const _sebaVoiceRateBuckets = new Map();
function _sebaVoiceRateLimit(ip){
  const now = Date.now();
  const bucket = _sebaVoiceRateBuckets.get(ip) || { count: 0, reset: now + 60000 };
  if (now > bucket.reset){ bucket.count = 0; bucket.reset = now + 60000; }
  bucket.count++;
  _sebaVoiceRateBuckets.set(ip, bucket);
  return bucket.count <= 60;
}

app.post('/api/telemetry/seba-voice', (req, res) => {
  const cl = parseInt(req.headers['content-length'] || '0', 10);
  if (cl > 4096) return res.status(413).json({ error: 'payload too large' });
  if (!_sebaVoiceRateLimit(req.ip)) return res.status(429).json({ error: 'rate limit' });
  const b = req.body || {};
  if (!b.tag || typeof b.tag !== 'string' || b.tag.length === 0 || b.tag.length > 64) {
    return res.status(400).json({ error: 'invalid tag' });
  }
  if (!SEBA_POOLS.has(b.pool)) return res.status(400).json({ error: 'invalid pool' });
  if (!SEBA_PERSONAS.has(b.persona)) return res.status(400).json({ error: 'invalid persona' });
  if (typeof b.fired !== 'boolean') return res.status(400).json({ error: 'invalid fired' });
  if (typeof b.captionRendered !== 'boolean') return res.status(400).json({ error: 'invalid captionRendered' });
  if (typeof b.voiceMutedByUser !== 'boolean') return res.status(400).json({ error: 'invalid voiceMutedByUser' });
  if (b.errorClass != null && (typeof b.errorClass !== 'string' || b.errorClass.length > 80)) {
    return res.status(400).json({ error: 'invalid errorClass' });
  }
  console.log('[SEBA-VOICE] ' + JSON.stringify({
    tag: b.tag, pool: b.pool, persona: b.persona,
    fired: b.fired, captionRendered: b.captionRendered,
    voiceMutedByUser: b.voiceMutedByUser, errorClass: b.errorClass,
    ip: req.ip
  }));
  return res.status(204).end();
});

// Phase v3.34.0 — Elder hint telemetry (spec §B; heka pattern).
// Architecture-gate: docs/superpowers/specs/2026-04-28-elder-hint-v2.md §B
const ELDER_HINT_REGISTERS = new Set(['comprehension', 'reflection']);
const ELDER_HINT_SOURCES = new Set(['ai', 'pool', 'curated']);
const ELDER_HINT_FALLBACK_REASONS = new Set([
  'budget', 'rate', 'gemini-error', 'invalid-output',
  'max-tokens', 'network', 'timeout', 'parse'
]);
const ELDER_HINT_ACTIONS = new Set(['shown', 'tapped', 'dismissed']);

const _elderHintRateBuckets = new Map();
function _elderHintRateLimit(ip){
  const now = Date.now();
  const bucket = _elderHintRateBuckets.get(ip) || { count: 0, reset: now + 60000 };
  if (now > bucket.reset){ bucket.count = 0; bucket.reset = now + 60000; }
  bucket.count++;
  _elderHintRateBuckets.set(ip, bucket);
  return bucket.count <= 60;
}

app.post('/api/telemetry/elder-hint', (req, res) => {
  const cl = parseInt(req.headers['content-length'] || '0', 10);
  if (cl > 4096) return res.status(413).json({ error: 'payload too large' });
  if (!_elderHintRateLimit(req.ip)) return res.status(429).json({ error: 'rate limit' });

  const b = req.body || {};

  // Per spec §B.2 validation rules
  if (b.schema !== 'v1') return res.status(400).json({ error: 'invalid schema' });
  if (typeof b.session_id !== 'string' || !/^[a-f0-9]{8,16}$/.test(b.session_id)) {
    return res.status(400).json({ error: 'invalid session_id' });
  }
  if (b.story_id !== null && (typeof b.story_id !== 'string' || b.story_id.length > 64 || !/^[a-z0-9-]+$/i.test(b.story_id))) {
    return res.status(400).json({ error: 'invalid story_id' });
  }
  if (b.chunk_id !== null && (!Number.isInteger(b.chunk_id) || b.chunk_id < 0 || b.chunk_id > 200)) {
    return res.status(400).json({ error: 'invalid chunk_id' });
  }
  if (!Number.isInteger(b.level) || b.level < 1 || b.level > 6) {
    return res.status(400).json({ error: 'invalid level' });
  }
  if (b.virtue !== null && (typeof b.virtue !== 'string' || b.virtue.length > 32)) {
    return res.status(400).json({ error: 'invalid virtue' });
  }
  if (!ELDER_HINT_REGISTERS.has(b.register)) return res.status(400).json({ error: 'invalid register' });
  if (b.hint_index !== 1 && b.hint_index !== 2) return res.status(400).json({ error: 'invalid hint_index' });
  if (typeof b.hint_id !== 'string' || b.hint_id.length === 0 || b.hint_id.length > 64) {
    return res.status(400).json({ error: 'invalid hint_id' });
  }
  if (!ELDER_HINT_SOURCES.has(b.source)) return res.status(400).json({ error: 'invalid source' });
  if (b.fallback_reason !== undefined && !ELDER_HINT_FALLBACK_REASONS.has(b.fallback_reason)) {
    return res.status(400).json({ error: 'invalid fallback_reason' });
  }
  if (!ELDER_HINT_ACTIONS.has(b.action)) return res.status(400).json({ error: 'invalid action' });
  if (!Number.isInteger(b.time_on_question_ms) || b.time_on_question_ms < 0) {
    return res.status(400).json({ error: 'invalid time_on_question_ms' });
  }
  if (b.time_shown_to_action_ms !== undefined && (!Number.isInteger(b.time_shown_to_action_ms) || b.time_shown_to_action_ms < 0)) {
    return res.status(400).json({ error: 'invalid time_shown_to_action_ms' });
  }
  if (typeof b.ua_family !== 'string' || b.ua_family.length > 32) {
    return res.status(400).json({ error: 'invalid ua_family' });
  }
  if (typeof b.reduced_motion !== 'boolean') return res.status(400).json({ error: 'invalid reduced_motion' });
  if (!Number.isInteger(b.ts) || b.ts < 0) return res.status(400).json({ error: 'invalid ts' });

  console.log('[ELDER-HINT-TEL] ' + JSON.stringify({ ...b, ip: req.ip }));
  return res.status(204).end();
});

// Phase v3.33.0 — Seba voice asset-presence health check.
// Sam's recommended notable addition from architecture-gate verdict —
// detect missing MP3 assets before users hit them.
const SEBA_POOL_COUNTS = {
  'young-mer': 10,
  'young-sedjm': 8,
  'young-rekh': 6,
  'young-celebration': 8,
  'young-achievement': 4,
  'elder-sema': 6,
  'elder-sema-daily': 8,
  'elder-sema-redirect': 4,
  'elder-sema-approval': 5
};

// v3.46.5 — Consistency-Coach Medium fix: process-level health endpoint
// for nginx / uptime monitoring. Mirrors the seba-api /api/health shape.
// Cheap (no DB hit, no disk). Returns 200 always when the process can
// respond — that IS the health signal.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'perankh',
    pid: process.pid,
    uptimeSec: Math.round(process.uptime()),
    nodeVersion: process.version,
    usersDbCheck: _usersDbStmtParentEmail ? 'enabled' : 'disabled',
    authSecret: process.env.AUTH_SECRET ? 'set' : 'ephemeral',
    ts: Date.now(),
  });
});

app.get('/api/health/seba-voice', (req, res) => {
  const missing = [];
  for (const [pool, count] of Object.entries(SEBA_POOL_COUNTS)){
    for (let i = 0; i < count; i++){
      const p = path.join(__dirname, 'public', 'audio', 'seba', pool, i + '.mp3');
      if (!fs.existsSync(p)) missing.push(pool + '/' + i + '.mp3');
    }
  }
  // Also verify silent prime
  const silent = path.join(__dirname, 'public', 'audio', 'silent.mp3');
  if (!fs.existsSync(silent)) missing.push('silent.mp3');
  if (missing.length){
    return res.status(503).json({ status: 'degraded', missing: missing });
  }
  return res.status(200).json({
    status: 'ok',
    pools: Object.keys(SEBA_POOL_COUNTS).length,
    total: Object.values(SEBA_POOL_COUNTS).reduce((a, b) => a + b, 0)
  });
});

// ── POST /api/telemetry/senebty-glossary — schema v1 ─────────────────────
const SENEBTY_TELEMETRY_DISABLED = process.env.SENEBTY_TELEMETRY_DISABLED === '1';
const SENEBTY_GLOSS_VALID_SOURCES = new Set(['search','chip','recent','reader-link']);

function senebtyGlossValidate(b){
  if (!b || typeof b !== 'object') return 'bad_body';
  if (b.schema !== 'v1') return 'bad_schema';
  if (typeof b.session_id !== 'string' || !/^[a-zA-Z0-9_]{3,40}$/.test(b.session_id)) return 'bad_session_id';
  if (typeof b.term !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(b.term)) return 'bad_term';
  if (!SENEBTY_GLOSS_VALID_SOURCES.has(b.source)) return 'bad_source';
  if (typeof b.level !== 'number' || !Number.isInteger(b.level) || b.level < 0 || b.level > 6) return 'bad_level';
  if (typeof b.reduced_motion !== 'boolean') return 'bad_reduced_motion';
  if (typeof b.ua_family !== 'string') return 'bad_ua_family';
  return null;
}

app.post('/api/telemetry/senebty-glossary', (req, res) => {
  if (SENEBTY_TELEMETRY_DISABLED) return res.status(204).end();
  // content-length guard at 4KB (the global json limit may be larger)
  const cl = Number(req.headers['content-length']);
  if (Number.isFinite(cl) && cl > 4096) return res.status(413).json({ error: 'payload_too_large' });
  // per-IP rate limit, 60/min
  if (!rateLimit(req.ip, 60)) return res.status(429).json({ error: 'rate_limited' });
  const err = senebtyGlossValidate(req.body);
  if (err) return res.status(400).json({ error: err });
  // coerce ua_family (mirrors Heka behaviour)
  const ua = HEKA_ALLOWED_UA.has(req.body.ua_family) ? req.body.ua_family : 'other';
  const ev = {
    ts: Date.now(),
    session_id: req.body.session_id,
    term: req.body.term,
    source: req.body.source,
    level: req.body.level,
    ua_family: ua,
    reduced_motion: !!req.body.reduced_motion
  };
  console.log('[SENEBTY-GLOSS-TEL]', JSON.stringify(ev));
  return res.status(204).end();
});

// ═══════════════════════════════════════════════════════════════════
// Reader recognition telemetry — structured client metrics, no transcripts
// ═══════════════════════════════════════════════════════════════════
// POST /api/telemetry/reader — accepts a small JSON blob with main-reader
// recognition timing + outcome, one event per chunk.  Same no-transcript
// contract as the Heka endpoint above.  Reader-specific fields: missed
// (Azure 'Omission' count), listened_ms (mic active time), circuit_open
// (was Azure skipped because the reader circuit-breaker was tripped?).
const READER_TEL_SCHEMA = 'v1';
const READER_ALLOWED_FALLBACK = new Set(['azure', 'webspeech']);
const READER_ALLOWED_COMPLETION = new Set(['ok', 'next', 'timeout', 'error', 'cancelled']);

function readerValidatePayload(raw){
  if (!raw || typeof raw !== 'object') return { ok:false, reason:'not_object' };
  if (raw.schema !== READER_TEL_SCHEMA) return { ok:false, reason:'bad_schema' };

  const session_id = hekaSanitizeId(raw.session_id);
  if (!session_id) return { ok:false, reason:'bad_session_id' };
  const story_id = hekaSanitizeId(raw.story_id);
  if (!story_id) return { ok:false, reason:'bad_story_id' };

  const chunk_id = typeof raw.chunk_id === 'number'
    ? hekaClamp(raw.chunk_id, 0, 999)
    : hekaSanitizeId(raw.chunk_id);
  if (chunk_id === null) return { ok:false, reason:'bad_chunk_id' };

  const level = hekaClamp(raw.level, 1, 6);
  if (level === null) return { ok:false, reason:'bad_level' };

  const region = typeof raw.region === 'string'
    ? raw.region.slice(0, HEKA_MAX_REGION_LEN).replace(/[^a-z0-9]/g, '')
    : '';

  const fallback_used = READER_ALLOWED_FALLBACK.has(raw.fallback_used) ? raw.fallback_used : null;
  if (!fallback_used) return { ok:false, reason:'bad_fallback_used' };

  const word_count = hekaClamp(raw.word_count, 0, 5000);
  const matched    = hekaClamp(raw.matched,    0, 5000);
  const missed     = hekaClamp(raw.missed,     0, 5000);
  if (word_count === null || matched === null || missed === null) {
    return { ok:false, reason:'bad_counts' };
  }

  const first_interim_ms = raw.first_interim_ms === null || raw.first_interim_ms === undefined
    ? null : hekaClamp(raw.first_interim_ms, 0, 60000);
  const first_confirm_ms = raw.first_confirm_ms === null || raw.first_confirm_ms === undefined
    ? null : hekaClamp(raw.first_confirm_ms, 0, 60000);
  const completed_ms = hekaClamp(raw.completed_ms, 0, 1800000); // 30min cap
  if (completed_ms === null) return { ok:false, reason:'bad_completed_ms' };
  const listened_ms  = hekaClamp(raw.listened_ms,  0, 1800000);
  if (listened_ms === null) return { ok:false, reason:'bad_listened_ms' };

  const completion = READER_ALLOWED_COMPLETION.has(raw.completion) ? raw.completion : null;
  if (!completion) return { ok:false, reason:'bad_completion' };

  const ua_family = HEKA_ALLOWED_UA.has(raw.ua_family) ? raw.ua_family : 'other';
  const reduced_motion = raw.reduced_motion === true;
  const circuit_open   = raw.circuit_open   === true;

  return {
    ok: true,
    clean: {
      schema: READER_TEL_SCHEMA,
      session_id, story_id, chunk_id, level, region,
      fallback_used, word_count, matched, missed,
      first_interim_ms, first_confirm_ms, completed_ms, listened_ms,
      completion, ua_family, reduced_motion, circuit_open,
    }
  };
}
const READER_TEL_MAX_BYTES = 4096;
app.post('/api/telemetry/reader', (req, res) => {
  if (process.env.READER_TELEMETRY_DISABLED === '1') return res.status(204).end();

  const cl = Number(req.headers['content-length']);
  if (Number.isFinite(cl) && cl > READER_TEL_MAX_BYTES) {
    return res.status(413).json({ error: 'payload_too_large' });
  }

  // One event per chunk; a long story is ~25 events. 120/min covers
  // multi-child households on a single NAT IP without throttling.
  if (!rateLimit(req.ip, 120)) return res.status(429).json({ error: 'rate_limited' });

  const result = readerValidatePayload(req.body);
  if (!result.ok) return res.status(400).json({ error: result.reason });

  console.log('[READER-TEL]', JSON.stringify(result.clean));
  res.status(204).end();
});

// ── POST /api/telemetry/flow-event — schema v1 ───────────────────────────
// Generic flow-event sink for client-side invariant violations and content-
// data misses (empty-questions guard, comprehensionPool fallback). Surfaces
// problems via [FLOW-EVENT] log lines so dev knows about silent failures
// without waiting for a child to report them. Mirrors the Heka/Reader/
// senebty-glossary pattern — content-length cap, per-IP rate limit, schema
// validation, no PII, no transcripts.
const FLOW_EVENT_TEL_DISABLED = process.env.FLOW_EVENT_TELEMETRY_DISABLED === '1';
const FLOW_EVENT_NAMES = new Set([
  'empty-questions-after-fallback',
  'comprehension-pool-fallback'
]);
const FLOW_EVENT_MAX_BYTES = 4096;
function flowEventValidate(b){
  if (!b || typeof b !== 'object') return 'bad_body';
  if (b.schema !== 'v1') return 'bad_schema';
  if (typeof b.session_id !== 'string' || !/^[a-zA-Z0-9_]{3,40}$/.test(b.session_id)) return 'bad_session_id';
  if (typeof b.event !== 'string' || !FLOW_EVENT_NAMES.has(b.event)) return 'bad_event';
  // story_id is optional but if present must be url-safe
  if (b.story_id !== null && b.story_id !== undefined){
    if (typeof b.story_id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(b.story_id)) return 'bad_story_id';
  }
  if (typeof b.level !== 'number' || !Number.isInteger(b.level) || b.level < 0 || b.level > 6) return 'bad_level';
  if (typeof b.reduced_motion !== 'boolean') return 'bad_reduced_motion';
  if (typeof b.ua_family !== 'string') return 'bad_ua_family';
  // meta is optional; if present, must be object with no nested objects > 1 level
  if (b.meta !== null && b.meta !== undefined){
    if (typeof b.meta !== 'object' || Array.isArray(b.meta)) return 'bad_meta';
    for (const k of Object.keys(b.meta)){
      const v = b.meta[k];
      if (v !== null && typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') return 'bad_meta_value';
    }
  }
  return null;
}
app.post('/api/telemetry/flow-event', (req, res) => {
  if (FLOW_EVENT_TEL_DISABLED) return res.status(204).end();
  const cl = Number(req.headers['content-length']);
  if (Number.isFinite(cl) && cl > FLOW_EVENT_MAX_BYTES) return res.status(413).json({ error: 'payload_too_large' });
  // Flow events are rare (only fires on content-data misses). 30/min/IP is
  // generous; anything spamming this endpoint is misuse worth rate-limiting.
  if (!rateLimit(req.ip, 30)) return res.status(429).json({ error: 'rate_limited' });
  const err = flowEventValidate(req.body);
  if (err) return res.status(400).json({ error: err });
  const ua = (HEKA_ALLOWED_UA && HEKA_ALLOWED_UA.has(req.body.ua_family)) ? req.body.ua_family : 'other';
  const ev = {
    ts: Date.now(),
    session_id: req.body.session_id,
    event: req.body.event,
    story_id: req.body.story_id || null,
    level: req.body.level,
    meta: req.body.meta || null,
    ua_family: ua,
    reduced_motion: !!req.body.reduced_motion
  };
  console.log('[FLOW-EVENT]', JSON.stringify(ev));
  return res.status(204).end();
});

// ═══════════════════════════════════════════════════════════════════
// Learn More library — curated YouTube feed for parent dashboard
// Fetches two channels via yt-dlp --flat-playlist, caches 2h in memory
// ═══════════════════════════════════════════════════════════════════
const LEARN_MORE_CHANNELS = [
  { handle: 'withoutHistory', display: 'Without History' },
  { handle: 'trillblk',       display: 'TrillBlk' },
  { handle: 'BuildingSe7en',  display: 'Building Se7en' },
  { handle: 'kamjiverse',     display: 'Kamjiverse' },
  { handle: 'Tapvideo',       display: 'Tapvideo' },
  { handle: 'kingmono',       display: 'The Kings Monologue' }
];
const LEARN_MORE_TTL_MS = 2 * 60 * 60 * 1000;
const LEARN_MORE_PER_CHANNEL = 20;
const LEARN_MORE_DISK_CACHE = path.join(__dirname, 'data', 'learn-more-cache.json');
let _learnMoreCache = null;

// v3.44.0 — boot-time disk-cache hydration. Lets the very first request
// after a deploy serve real videos even before yt-dlp gets a chance to run.
function hydrateLearnMoreFromDisk() {
  try {
    if (!fs.existsSync(LEARN_MORE_DISK_CACHE)) return;
    const raw = fs.readFileSync(LEARN_MORE_DISK_CACHE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.videos) && parsed.cachedAt) {
      _learnMoreCache = { cachedAt: parsed.cachedAt, payload: parsed };
      console.log('[learn-more] hydrated disk cache:', parsed.videos.length, 'videos from', new Date(parsed.cachedAt).toISOString());
    }
  } catch (e) {
    console.warn('[learn-more] disk cache hydrate failed:', e.message);
  }
}
hydrateLearnMoreFromDisk();

function persistLearnMoreToDisk(payload) {
  try {
    fs.mkdirSync(path.dirname(LEARN_MORE_DISK_CACHE), { recursive: true });
    fs.writeFileSync(LEARN_MORE_DISK_CACHE, JSON.stringify(payload), 'utf8');
  } catch (e) {
    console.warn('[learn-more] disk cache write failed:', e.message);
  }
}

function fetchChannelFlat(handle) {
  return new Promise((resolve) => {
    // v3.44.0 — re-resolve YT_DLP_BIN on every call so a stale module-load
    // resolution can't permanently break the feed (was: bare 'yt-dlp' →
    // ENOENT under PM2 PATH stripping).
    const bin = getYtDlpBin();
    const args = [
      '--flat-playlist',
      '--dump-single-json',
      '--playlist-end', String(LEARN_MORE_PER_CHANNEL),
      '--no-warnings',
      `https://www.youtube.com/@${handle}/videos`
    ];
    const startedAt = Date.now();
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', (code) => {
      const ms = Date.now() - startedAt;
      if (code !== 0) {
        console.warn(`[learn-more] ${JSON.stringify({event:'yt_dlp_exit_nonzero', handle, code, ms, bin, stderr: stderr.slice(0,200)})}`);
        return resolve(null);
      }
      try {
        const data = JSON.parse(stdout);
        const entries = (data && Array.isArray(data.entries)) ? data.entries.length : 0;
        console.log(`[learn-more] ${JSON.stringify({event:'yt_dlp_ok', handle, entries, ms, bin})}`);
        resolve(data);
      } catch (e) {
        console.warn(`[learn-more] ${JSON.stringify({event:'yt_dlp_json_parse_failed', handle, ms, error: e.message})}`);
        resolve(null);
      }
    });
    proc.on('error', (e) => {
      console.warn(`[learn-more] ${JSON.stringify({event:'yt_dlp_spawn_failed', handle, bin, error: e.message})}`);
      resolve(null);
    });
  });
}

function normalizeChannelFeed(data, displayName) {
  if (!data || !Array.isArray(data.entries)) return { channel: null, videos: [] };
  const channel = {
    id: data.channel_id || '',
    name: data.channel || displayName,
    handle: (data.uploader_id || '').replace(/^@/, ''),
    url: data.channel_url || `https://www.youtube.com/@${displayName}`,
    subscribers: data.channel_follower_count || 0
  };
  const videos = data.entries
    .filter(e => e && e.id && e.title)
    .map(e => ({
      id: e.id,
      title: e.title,
      duration: Math.round(e.duration || 0),
      views: e.view_count || 0,
      url: e.url || `https://www.youtube.com/watch?v=${e.id}`,
      thumb: `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`,
      channel: channel.name,
      channelHandle: channel.handle
    }));
  return { channel, videos };
}

// v3.44.5 — in-flight promise dedup. Concurrent ?refresh=1 calls used to
// each spawn yt-dlp independently; a flurry from N parallel browsers would
// hammer the upstream channel pages N times. Single-flight pattern: the
// FIRST refresher kicks off the fetch + caches the promise; subsequent
// callers in flight await the same promise and get the same payload.
let _learnMoreInFlight = null;

// Shared response-shaper for both the single-flight owner AND the inflight
// joiners. Takes the raw `results` array (per-channel {channel, videos}),
// updates the in-memory + disk caches on success, and returns the final
// JSON response. Idempotent — safe for the joiner path even though the
// cache was already updated by the owner.
function _serveLearnMoreFromResults(res, requestId, results, now) {
  const channels = results.map(r => r.channel).filter(Boolean);
  const perChannel = results.map(r => r.videos);
  const interleaved = [];
  const maxLen = Math.max(...perChannel.map(v => v.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const vs of perChannel) if (vs[i]) interleaved.push(vs[i]);
  }
  if (interleaved.length) {
    const payload = { channels, videos: interleaved, cachedAt: now };
    // Joiner path may already have the same payload cached (owner wrote it
    // before resolve). Re-write is idempotent.
    _learnMoreCache = { cachedAt: now, payload };
    persistLearnMoreToDisk(payload);
    console.log('[learn-more] ' + JSON.stringify({requestId, event:'fresh_fetch_ok', videos: interleaved.length, channels: channels.length}));
    return res.json({ ...payload, cached: false, source: 'fresh' });
  }
  if (_learnMoreCache && _learnMoreCache.payload.videos.length) {
    const ageMs = now - _learnMoreCache.cachedAt;
    console.warn('[learn-more] ' + JSON.stringify({requestId, event:'fresh_empty_serving_stale', stale_age_ms: ageMs, videos: _learnMoreCache.payload.videos.length}));
    return res.json({
      ...(_learnMoreCache.payload),
      cached: true,
      source: 'stale_fallback',
      error: 'Live feed unavailable; showing last known good videos.',
      staleAgeMs: ageMs
    });
  }
  console.error('[learn-more] ' + JSON.stringify({requestId, event:'cold_start_failure', bin: getYtDlpBin()}));
  return res.status(503).json({
    error: 'Video feed temporarily unavailable. Please try again in a few minutes.',
    requestId
  });
}

app.get('/api/learn-more-library/feed', async (req, res) => {
  // v3.44.0 — Enterprise-grade resilience:
  //   - 200 (with `error` + cached `videos`) instead of 503 when fresh fetch
  //     fails BUT a disk cache exists. Frontend renders the cached set + a
  //     "live feed unavailable, showing last known good" banner.
  //   - 503 ONLY when there's literally no cache to serve (cold start failure).
  //   - Structured telemetry on every code path (cache hit, cache miss, fresh
  //     fetch ok/empty, disk fallback hit).
  const requestId = crypto.randomBytes ? crypto.randomBytes(6).toString('hex') : Date.now().toString(36);
  try {
    const now = Date.now();
    const forceRefresh = req.query.refresh === '1';

    if (!forceRefresh && _learnMoreCache && (now - _learnMoreCache.cachedAt) < LEARN_MORE_TTL_MS) {
      console.log('[learn-more] ' + JSON.stringify({requestId, event:'cache_hit', age_ms: now - _learnMoreCache.cachedAt, videos: _learnMoreCache.payload.videos.length}));
      return res.json({ ...(_learnMoreCache.payload), cached: true, source: 'memory' });
    }

    // v3.44.5 — single-flight dedup. If another request is already running
    // the upstream yt-dlp fetch, await its promise instead of spawning a
    // second one. Halves yt-dlp pressure during deploy-then-bunch-of-tabs
    // refresh storms.
    if (_learnMoreInFlight) {
      console.log('[learn-more] ' + JSON.stringify({requestId, event:'inflight_join'}));
      const results = await _learnMoreInFlight;
      return _serveLearnMoreFromResults(res, requestId, results, now);
    }

    _learnMoreInFlight = Promise.all(
      LEARN_MORE_CHANNELS.map(c => fetchChannelFlat(c.handle).then(d => normalizeChannelFeed(d, c.display)))
    );
    let results;
    try {
      results = await _learnMoreInFlight;
    } finally {
      _learnMoreInFlight = null;
    }
    return _serveLearnMoreFromResults(res, requestId, results, now);
  } catch (e) {
    console.error('[learn-more] ' + JSON.stringify({requestId, event:'unexpected_error', error: e.message}));
    res.status(500).json({ error: 'Feed error', requestId });
  }
});

// Art files served via early middleware (see top of file)

// Production error handler — never leak stack traces
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request too large' });
  }
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

const PORT = 3456;
app.listen(PORT, () => {
  const azureKey = process.env.AZURE_SPEECH_KEY;
  console.log(`\n  ╔═══════════════════════════════════════╗`);
  console.log(`  ║   TubeGrab Server running on :${PORT}    ║`);
  console.log(`  ║   http://localhost:${PORT}              ║`);
  console.log(`  ║   Saving to: ~/Documents              ║`);
  console.log(`  ║   Azure TTS: ${azureKey ? '✓ ENABLED' : '✗ Not configured'}             ║`);
  console.log(`  ╚═══════════════════════════════════════╝\n`);
  if (!azureKey) {
    console.log('  To enable African TTS voices:');
    console.log('  AZURE_SPEECH_KEY=your-key AZURE_SPEECH_REGION=eastus node server.js\n');
  }
});
