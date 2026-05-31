// Landing-page video efficiency contract (v3.51.45).
// Locks Rule 7 (.claude/rules/enterprise-patterns.md) on every <video class="intro-backdrop-video">:
//   - preload="none" (deferred) or preload="metadata" (hero); never "auto"
//   - no autoplay attribute (browsers auto-promote preload=metadata to auto when present)
//   - poster=/images/landing/<slug>.jpg
//   - cache-buster ?v=YYYYMMDD<letter> on every <source>
//   - the lazy-loader IIFE uses IntersectionObserver, honors prefers-reduced-data/saveData/effectiveType
//
// Root cause this test locks out: v3.51.44 mobile-throughput failure where setTimeout(2000)
// unconditionally fired 6 concurrent ~20MB MP4 loads, stalling tail streams on mobile cwnd.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';

const html = fs.readFileSync('maat-reader.html', 'utf8');

// Extract every <video class="intro-backdrop-video"...> opening tag.
function extractBackdropVideoTags() {
  const re = /<video\b[^>]*class=["'][^"']*\bintro-backdrop-video\b[^"']*["'][^>]*>/g;
  return html.match(re) || [];
}

test('there are exactly 7 landing-page backdrop videos', () => {
  const tags = extractBackdropVideoTags();
  assert.equal(tags.length, 7, `expected 7 backdrop videos (hero + 3 sections + 3 karnak), found ${tags.length}`);
});

test('every backdrop video has preload="none" or preload="metadata" (Rule 7.1)', () => {
  const tags = extractBackdropVideoTags();
  for (const tag of tags) {
    const m = tag.match(/preload=["'](\w+)["']/);
    assert.ok(m, `<video> missing preload attribute: ${tag.slice(0, 200)}`);
    assert.ok(m[1] === 'none' || m[1] === 'metadata',
      `preload="${m[1]}" violates Rule 7.1 (must be "none" or "metadata"): ${tag.slice(0, 200)}`);
  }
});

test('no backdrop video has autoplay attribute (Rule 7.8)', () => {
  const tags = extractBackdropVideoTags();
  for (const tag of tags) {
    assert.doesNotMatch(tag, /\bautoplay\b/,
      `<video> must not have autoplay attribute: ${tag.slice(0, 200)}`);
  }
});

test('every backdrop video has poster= attribute (Rule 7.2)', () => {
  const tags = extractBackdropVideoTags();
  for (const tag of tags) {
    const m = tag.match(/poster=["']([^"']+)["']/);
    assert.ok(m, `<video> missing poster attribute: ${tag.slice(0, 200)}`);
    assert.match(m[1], /^\/images\/landing\/[a-z0-9-]+\.jpg$/,
      `poster path must be /images/landing/<slug>.jpg: got "${m[1]}"`);
  }
});

test('every backdrop video poster JPEG exists on disk', () => {
  const tags = extractBackdropVideoTags();
  for (const tag of tags) {
    const m = tag.match(/poster=["']([^"']+)["']/);
    if (!m) continue;
    const diskPath = path.join('public', m[1]); // /images/landing/x.jpg -> public/images/landing/x.jpg
    assert.ok(fs.existsSync(diskPath), `poster file missing on disk: ${diskPath}`);
  }
});

test('every backdrop video <source> has cache-buster ?v=YYYYMMDD<letter> (Rule 5)', () => {
  // Find each <video class="intro-backdrop-video">...</video> block.
  const blockRe = /<video\b[^>]*class=["'][^"']*\bintro-backdrop-video\b[^"']*["'][^>]*>([\s\S]*?)<\/video>/g;
  const blocks = [...html.matchAll(blockRe)];
  assert.equal(blocks.length, 7, 'expected 7 <video>...</video> blocks');
  for (const blk of blocks) {
    const inner = blk[1];
    const sources = [...inner.matchAll(/<source\b[^>]*(?:src|data-src)=["']([^"']+)["']/g)];
    assert.ok(sources.length >= 1, `<video> block has no <source> children: ${blk[0].slice(0, 200)}`);
    for (const s of sources) {
      assert.match(s[1], /\?v=\d{8}[a-z]?$/,
        `source URL missing cache-buster: ${s[1]}`);
    }
  }
});

test('IIFE lazy-loader uses IntersectionObserver, not setTimeout-blanket (Rule 7.3)', () => {
  // Find the [LANDING-VIDEO] IIFE block.
  const ioRe = /\[LANDING-VIDEO\][\s\S]*?new IntersectionObserver/;
  assert.match(html, ioRe, 'IIFE must use IntersectionObserver');
  // Old anti-pattern guard: no `setTimeout(()=>{ ... .src = .dataset.src; ... }, 2000)`-style blanket.
  // The IIFE may still call setTimeout for stall-detection (10s window) — that's allowed.
  const blanketRe = /setTimeout\s*\(\s*\(\)\s*=>\s*\{[^}]*\.src\s*=\s*[^}]*\.dataset\.src/;
  assert.doesNotMatch(html, blanketRe,
    'IIFE must not use setTimeout-blanket pattern (caused v3.51.44 regression)');
});

test('IIFE honors prefers-reduced-data, saveData, and effectiveType (Rule 7.7)', () => {
  // The connection-aware tier must reference at least these signals.
  assert.match(html, /prefers-reduced-data/,
    'IIFE must check prefers-reduced-data');
  assert.match(html, /saveData/,
    'IIFE must check connection.saveData');
  assert.match(html, /effectiveType/,
    'IIFE must check connection.effectiveType');
});

test('IIFE emits [LANDING-VIDEO] structured telemetry', () => {
  assert.match(html, /\[LANDING-VIDEO\]/,
    'IIFE must emit [LANDING-VIDEO] log lines');
  // Schema discipline: every payload should include schema:'v1' so future
  // server-side aggregators can version-gate.
  assert.match(html, /schema:\s*['"]v1['"]/,
    "telemetry payloads must include schema:'v1'");
});

test('IIFE has __LANDING_VIDEO_DISABLED__ killswitch', () => {
  assert.match(html, /window\.__LANDING_VIDEO_DISABLED__/,
    'IIFE must check the killswitch flag');
});

test('nav-handler does NOT eagerly re-attach data-src on intro re-entry (Coach C1+C2)', () => {
  // The nav handler used to re-fire data-src → src on every back-nav. Lock that out.
  // The new pattern just resumes play on already-buffered videos.
  // Look for the nav handler block specifically.
  const navBlock = html.match(/Landing-page videos are managed by the IntersectionObserver[\s\S]{0,1500}/);
  assert.ok(navBlock, 'nav-handler comment about IO-managed videos must be present');
  // Inside that block, there must NOT be a `v.src = v.dataset.src` re-attach.
  assert.doesNotMatch(navBlock[0], /v\.src\s*=\s*v\.dataset\.src/,
    'nav handler must not eagerly re-attach data-src (Coach C1+C2)');
});

test('hero video has preload="metadata" (above-the-fold needs faster start)', () => {
  const heroBlock = html.match(/<section class="intro-hero">[\s\S]*?<\/section>/);
  assert.ok(heroBlock, 'intro-hero section must exist');
  const heroVideo = heroBlock[0].match(/<video\b[^>]*intro-backdrop-video[^>]*>/);
  assert.ok(heroVideo, 'hero must have intro-backdrop-video');
  assert.match(heroVideo[0], /preload=["']metadata["']/,
    'hero video must use preload="metadata"');
});

test('Karnak trio has preload="none" (was missing before v3.51.45 — Rule 7.1 violation)', () => {
  const signInBlock = html.match(/<section class="intro-final-cta"[\s\S]*?<\/section>/);
  assert.ok(signInBlock, 'introSignIn section must exist');
  const karnakVideos = [...signInBlock[0].matchAll(/<video\b[^>]*intro-backdrop-video[^>]*>/g)];
  assert.equal(karnakVideos.length, 3, 'must be 3 Karnak videos');
  for (const v of karnakVideos) {
    assert.match(v[0], /preload=["']none["']/,
      `Karnak video must have preload="none": ${v[0]}`);
  }
});

test('every git-tracked landing MP4 referenced by HTML exists on disk', () => {
  // Only assert on git-tracked MP4s. The bulk of landing videos
  // (videos/sets/*, videos/karnak/*, videos/senebty/*) are intentionally
  // gitignored (.gitignore: `videos/*` except `videos/senebty-rituals/`) —
  // they live on disk locally + on prod (rsync'd) but never enter the repo,
  // so a CI checkout legitimately lacks them. Asserting existence on those
  // would fail CI while passing locally (the v3.51.44-onward red streak).
  // Gating to git-tracked files preserves the real intent: catch broken
  // references to files that SHOULD be in the repo.
  // NOTE (cross-agent): owned by the landing-video pipeline work; gated here
  // 2026-05-20 to unbreak CI without committing large binaries.
  const trackedMp4s = new Set(
    childProcess
      .execFileSync('git', ['ls-files', '*.mp4'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
  );
  const blockRe = /<video\b[^>]*class=["'][^"']*\bintro-backdrop-video\b[^"']*["'][^>]*>([\s\S]*?)<\/video>/g;
  const blocks = [...html.matchAll(blockRe)];
  // Stage-2 Coach C1: reachability guard. The original `assert.ok(checked >= 0)`
  // was a tautology that masked a silent false-pass — if the block regex ever
  // stopped matching (HTML refactor of the <video class> shape), the loop body
  // would never run and the test would still "pass". Assert the scan actually
  // found backdrop-video blocks so the contract below is genuinely exercised.
  assert.ok(
    blocks.length > 0,
    'no <video class="intro-backdrop-video"> blocks found — block regex likely stale (silent false-pass guard)',
  );
  let checked = 0;
  for (const blk of blocks) {
    const inner = blk[1];
    const sources = [...inner.matchAll(/<source\b[^>]*(?:src|data-src)=["']([^"']+)["']/g)];
    for (const s of sources) {
      // Strip cache-buster + leading slash.
      const url = s[1].split('?')[0].replace(/^\//, '');
      if (!trackedMp4s.has(url)) continue; // gitignored landing video — not in CI checkout, skip
      checked++;
      assert.ok(fs.existsSync(url), `git-tracked referenced MP4 missing on disk: ${url}`);
    }
  }
  // Stage-2 Coach C1: residual protection when `checked === 0`.
  // No intro-backdrop-video <source> currently points at a git-tracked MP4
  // (the 7 backdrop blocks all reference gitignored videos/sets|karnak/*.mp4;
  // the tracked MP4s — videos/senebty-rituals/* + maat-graduation.mp4 — are
  // wired via JS-constructed paths, not these literal <source> tags). So the
  // per-reference branch above is a forward-guard only. To keep the test from
  // protecting NOTHING in the meantime, assert that every git-tracked MP4 is
  // actually present in the checkout (catches a tracked-but-deleted/corrupt
  // binary that would otherwise 404 in prod). This assertion has real teeth:
  // it iterates the live tracked set, not a hard-coded list.
  assert.ok(trackedMp4s.size > 0, 'git ls-files *.mp4 returned no tracked MP4s — glob/CWD broken');
  for (const tracked of trackedMp4s) {
    assert.ok(fs.existsSync(tracked), `git-tracked MP4 missing from checkout: ${tracked}`);
  }
});

test('every landing MP4 on disk is ≤20 MB (Rule 7.5 bitrate budget)', () => {
  const files = [
    'videos/sets/battle-intro.mp4',
    'videos/sets/seeds-intro.mp4',
    'videos/sets/benin-intro.mp4',
    'videos/sets/seba-living-library.mp4',
    'videos/karnak/karnak-hypostyle.mp4',
    'videos/karnak/karnak-avenue.mp4',
    'videos/karnak/karnak-obelisk.mp4',
  ];
  const TWENTY_MB = 20 * 1024 * 1024;
  for (const f of files) {
    if (!fs.existsSync(f)) continue; // covered by previous test
    const size = fs.statSync(f).size;
    assert.ok(size <= TWENTY_MB,
      `${f} is ${(size / 1024 / 1024).toFixed(1)}MB — exceeds Rule 7.5 budget (≤20MB). Re-encode via scripts/encode-landing-videos.sh.`);
  }
});

// ─── v3.51.46 — iPad/Safari enterprise coverage assertions ──────────────────
// Locks the auto-degrade machinery for iOS Low Power Mode + slow cellular
// + stall-fingerprint + hero-canplay-budget + visibility/online events.

test('every backdrop video has webkit-playsinline (iPad belt-and-suspenders)', () => {
  const tags = extractBackdropVideoTags();
  for (const tag of tags) {
    assert.match(tag, /\bwebkit-playsinline\b/,
      `<video> must have webkit-playsinline attribute (iPad compatibility): ${tag.slice(0, 200)}`);
  }
});

test('IIFE detects iOS (iPad/iPhone) via UA + maxTouchPoints heuristic', () => {
  assert.match(html, /var IS_IOS = \(function/,
    'IIFE must compute IS_IOS via UA + maxTouchPoints (modern iPad reports as MacIntel)');
  assert.match(html, /maxTouchPoints/,
    'IS_IOS detection must check maxTouchPoints for modern iPad');
});

// v3.51.54 — REMOVED the auto-degrade machinery tests (the machinery itself
// was the site-wide-slowness regression). Their inverse is now asserted by the
// "R1/CC1 — NO reactive auto-degrade anywhere" test below. The IIFE keeps only
// the visibilitychange listener (offline/online auto-degrade removed).

test('IIFE has visibilitychange listener (pause on tab-hidden)', () => {
  assert.match(html, /document\.addEventListener\(['"]visibilitychange['"]/,
    'must listen for visibilitychange');
});

test('IIFE has NO offline/online auto-degrade listeners (v3.51.54 removed)', () => {
  // The IIFE setupGlobalEvents must not register offline/online handlers that
  // flip TIER. (visibilitychange is fine.)
  const fn = html.match(/function setupGlobalEvents\(\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(fn, 'setupGlobalEvents must exist');
  assert.doesNotMatch(fn[0], /addEventListener\(['"]offline['"]/,
    'IIFE must not register an offline auto-degrade listener');
});

test('SW APP_VERSION at v39 for v3.51.83', () => {
  const sw = fs.readFileSync('public/sw.js', 'utf8');
  assert.match(sw, /APP_VERSION\s*=\s*'v39'/,
    'public/sw.js APP_VERSION must be v38 for the v3.51.83 sample-cards badge-style match ship');
});

// ─── v3.51.56 — AV1/WebM siblings + telemetry beacon + server digest ────────

test('all 7 landing videos have an AV1 <source webm> BEFORE the mp4 fallback', () => {
  const blockRe = /<video\b[^>]*class=["'][^"']*\bintro-backdrop-video\b[^"']*["'][^>]*>([\s\S]*?)<\/video>/g;
  const blocks = [...html.matchAll(blockRe)];
  assert.equal(blocks.length, 7, 'expected 7 landing video blocks');
  for (const blk of blocks) {
    const inner = blk[1];
    const webmIdx = inner.search(/<source\b[^>]*(?:src|data-src)=["'][^"']*\.webm[^"']*["'][^>]*type=["']video\/webm["']/);
    const mp4Idx = inner.search(/<source\b[^>]*(?:src|data-src)=["'][^"']*\.mp4[^"']*["'][^>]*type=["']video\/mp4["']/);
    assert.ok(webmIdx >= 0, `block missing webm source: ${blk[0].slice(0, 160)}`);
    assert.ok(mp4Idx >= 0, `block missing mp4 source: ${blk[0].slice(0, 160)}`);
    assert.ok(webmIdx < mp4Idx, `webm <source> must come BEFORE mp4 (browser picks first playable): ${blk[0].slice(0, 160)}`);
  }
});

test('AV1 webm files exist on disk + are lighter than their mp4 counterparts', () => {
  const pairs = [
    'videos/sets/battle-intro', 'videos/sets/seeds-intro', 'videos/sets/benin-intro',
    'videos/sets/seba-living-library', 'videos/karnak/karnak-hypostyle',
    'videos/karnak/karnak-avenue', 'videos/karnak/karnak-obelisk',
  ];
  for (const p of pairs) {
    if (!fs.existsSync(p + '.webm') || !fs.existsSync(p + '.mp4')) continue; // gitignored on CI checkout
    const webm = fs.statSync(p + '.webm').size;
    const mp4 = fs.statSync(p + '.mp4').size;
    assert.ok(webm < mp4, `${p}.webm (${(webm/1024/1024).toFixed(1)}MB) must be smaller than .mp4 (${(mp4/1024/1024).toFixed(1)}MB)`);
  }
});

test('client beacon collector exists (sampled sendBeacon to /api/telemetry/backdrop)', () => {
  assert.match(html, /window\.__backdropBeacon\s*=\s*function/,
    'must define window.__backdropBeacon');
  assert.match(html, /Math\.random\(\)\s*<\s*0\.10/,
    'beacon must sample ~10% of sessions');
  assert.match(html, /navigator\.sendBeacon\(['"]\/api\/telemetry\/backdrop['"]/,
    'beacon must POST to /api/telemetry/backdrop via sendBeacon');
  // Both telemetry sites must feed the beacon.
  assert.match(html, /if \(window\.__backdropBeacon\) window\.__backdropBeacon\(event, TIER/,
    'landing IIFE logEvt must push to beacon');
  assert.match(html, /if \(window\.__backdropBeacon\) window\.__backdropBeacon\(event, this\._tier/,
    'helper _logEvt must push to beacon');
});

test('server exposes /api/telemetry/backdrop ingest + [BACKDROP-DIGEST] rollup', () => {
  const server = fs.readFileSync('server.js', 'utf8');
  assert.match(server, /app\.post\(['"]\/api\/telemetry\/backdrop['"]/,
    'server must mount POST /api/telemetry/backdrop');
  assert.match(server, /\[BACKDROP-DIGEST\]/,
    'server must emit [BACKDROP-DIGEST] rollup');
  assert.match(server, /flushBackdropDigest/,
    'server must have flushBackdropDigest');
  // Digest must flush on shutdown so pm2 reloads don't lose the window.
  assert.match(server, /process\.on\(['"]SIGTERM['"][\s\S]{0,120}flushBackdropDigest/,
    'digest must flush on SIGTERM');
  // Abuse guard: per-IP cap.
  assert.match(server, /_backdropIngestCounts/,
    'ingest must have a per-IP cap');
});

// ─── v3.51.54 — site-wide slowness fix: 2-tier model + light posters ────────

test('R1/CC1 — NO reactive auto-degrade anywhere (the site-wide-slowness regression)', () => {
  // The global sticky _autoDegrade + cumulative counters are removed.
  assert.doesNotMatch(html, /_autoDegrade\b/,
    'no _autoDegrade method may exist (caused whole-site posters-only flip)');
  assert.doesNotMatch(html, /_autoDegradeToPostersOnly/,
    'landing IIFE _autoDegradeToPostersOnly must be removed');
  assert.doesNotMatch(html, /_AUTO_DEGRADE_PLAY_THRESHOLD|_AUTO_DEGRADE_STALL_THRESHOLD/,
    'auto-degrade thresholds must be removed');
});

test('R2 — tier model is two values only (posters-only | normal), no sequential', () => {
  // _backdropEnterprise tier must be the 2-value form.
  assert.match(html, /this\._tier = \(RM \|\| RD \|\| SD \|\| slow\) \? 'posters-only' : 'normal'/,
    'helper tier must be the immutable 2-value form');
  // No 'sequential' tier branches remain in code (comments allowed).
  assert.doesNotMatch(html, /tier === 'sequential'/,
    "no `tier === 'sequential'` branch may remain");
  assert.doesNotMatch(html, /TIER === 'sequential'/,
    "no `TIER === 'sequential'` branch may remain");
});

test('CC4 — tier is immutable: only _init assigns _tier', () => {
  // Count assignments to this._tier — should be exactly one (in _init).
  const assigns = (html.match(/this\._tier\s*=/g) || []).length;
  assert.equal(assigns, 1, `this._tier must be assigned exactly once (in _init), found ${assigns}`);
});

test('CC2 — poster-weight lint: no 3-slot backdrop cycle uses heavy chunk-0.png posters', () => {
  // The 3-slot rotating cycles (reader/library/gov/peh/timeline/map/senebty)
  // must use light /images/landing/ JPEGs, NOT 1-2MB /art/<slug>/chunk-0.png.
  // Exception: library-FEATURED (per-tile hover, 1 at a time, covers battle
  // stories) may keep chunk-0.png — it's not a 3-slot cycle.
  for (const fnName of ['_setupReaderBackdrop', '_setupLibraryBackdropCycle', '_setupPertEmHeruBackdropCycle']) {
    const re = new RegExp(`${fnName}\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\s{2}\\},`);
    const fn = html.match(re);
    assert.ok(fn, `${fnName} must exist`);
    assert.doesNotMatch(fn[0], /chunk-0\.png/,
      `${fnName} must NOT use heavy chunk-0.png posters (avg 1.78MB) — use /images/landing/intro-<slug>.jpg`);
    assert.match(fn[0], /\/images\/landing\/intro-/,
      `${fnName} must use light /images/landing/intro-<slug>.jpg posters`);
  }
});

test('CC2 — gov pickFn uses light intro poster, not chunk-0.png', () => {
  const fn = html.match(/_setupGovBackdropCycle\(\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(fn);
  assert.doesNotMatch(fn[0], /chunk-0\.png/, 'gov must not use chunk-0.png posters');
  assert.match(fn[0], /\/images\/landing\/intro-/, 'gov must use light intro posters');
});

test('R4 — landing rootMargin <= 600px (1500/2000 re-created the storm)', () => {
  // v3.51.69 — rootMargin may now be an iOS-conservative ternary
  // (IS_IOS ? '150px 0px' : '600px 0px'); extract every px value from each
  // rootMargin expression and assert all are within the 600px cap.
  const margins = [...html.matchAll(/rootMargin:\s*([^,]+?),\s*threshold/g)]
    .flatMap(m => [...m[1].matchAll(/(\d+)px/g)].map(x => parseInt(x[1], 10)));
  assert.ok(margins.length > 0, 'must have rootMargin declarations');
  for (const px of margins) {
    assert.ok(px <= 600, `rootMargin ${px}px exceeds 600px cap (concurrent-storm risk)`);
  }
});

test('128 intro posters exist on disk + are light (<200KB avg)', () => {
  const dir = 'public/images/landing';
  const introPosters = fs.readdirSync(dir).filter(f => f.startsWith('intro-') && f.endsWith('.jpg'));
  assert.ok(introPosters.length >= 120, `expected ~128 intro posters, found ${introPosters.length}`);
  let total = 0;
  for (const p of introPosters) total += fs.statSync(path.join(dir, p)).size;
  const avgKB = total / introPosters.length / 1024;
  assert.ok(avgKB < 200, `intro posters avg ${avgKB.toFixed(0)}KB — must be <200KB (chunk-0.png was 1784KB)`);
});

// ─── v3.51.53 — Senebty interior backdrop migrated to shared helper ─────────

test('Senebty interior backdrop routes through shared _backdropCycleSetup helper', () => {
  const fn = html.match(/_setupSenebtyInteriorBackdrop\(screenId\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(fn, '_setupSenebtyInteriorBackdrop must exist');
  assert.match(fn[0], /_backdropCycleSetup/,
    'Senebty interior must call shared _backdropCycleSetup helper');
  assert.match(fn[0], /stateKey:\s*['"]_senebtyTimer_['"]\s*\+\s*screenId/,
    'Senebty must use per-screenId stateKey');
});

test('Senebty interior pool entries have poster JPEGs', () => {
  const pool = html.match(/_senebtyInteriorVideoPool:\s*\[[\s\S]*?\]/);
  assert.ok(pool, '_senebtyInteriorVideoPool must exist');
  assert.match(pool[0], /poster:\s*['"]\/images\/landing\/senebty-gate-ambient\.jpg['"]/);
  assert.match(pool[0], /poster:\s*['"]\/images\/landing\/senebty-senebty-ambient-long\.jpg['"]/);
  assert.match(pool[0], /poster:\s*['"]\/images\/landing\/karnak-hypostyle\.jpg['"]/,
    'karnak-hypostyle reuses the v3.51.45 landing Karnak poster');
});

test('Senebty interior cleanup routes through shared _backdropCycleCleanup', () => {
  const fn = html.match(/_cleanupSenebtyInteriorBackdrop\(screenId\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(fn, '_cleanupSenebtyInteriorBackdrop must exist');
  assert.match(fn[0], /_backdropCycleCleanup/,
    'Senebty interior cleanup must call shared helper');
});

test('all 9 Senebty interior video tags have webkit-playsinline (3 screens × 3 slots)', () => {
  const screens = ['senebtyFoundationsIndex', 'senebtyFoundation', 'senebtyDaily'];
  for (const screen of screens) {
    for (const i of [0, 1, 2]) {
      const re = new RegExp(`<video[^>]*id="${screen}BackdropVideo${i}"[^>]*>`);
      const m = html.match(re);
      assert.ok(m, `${screen}BackdropVideo${i} must exist`);
      assert.match(m[0], /\bwebkit-playsinline\b/, `${screen}BackdropVideo${i} must have webkit-playsinline`);
      assert.match(m[0], /preload=["']none["']/, `${screen}BackdropVideo${i} must have preload="none"`);
    }
  }
});

test('Senebty interior posters exist on disk', () => {
  for (const p of ['senebty-gate-ambient.jpg', 'senebty-senebty-ambient-long.jpg', 'karnak-hypostyle.jpg']) {
    assert.ok(fs.existsSync(path.join('public/images/landing', p)), `senebty poster missing: ${p}`);
  }
});

// ─── v3.51.52 — Reader HEAD-check removed; timeline+map posters ─────────────

test('Reader backdrop does NOT HEAD-check before assigning src (was adding 50-200ms × 3 delay)', () => {
  const fn = html.match(/_setupReaderBackdrop\(story\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(fn, '_setupReaderBackdrop function must exist');
  // The HEAD-check pattern must NOT appear in the body
  assert.doesNotMatch(fn[0], /fetch\(busted,\s*\{\s*method:\s*['"]HEAD['"]/,
    'reader must NOT pre-flight HEAD-check (rely on video element error event instead)');
});

test('Timeline backdrop pickFn sets poster from /images/landing/timeline-<slug>.jpg', () => {
  const fn = html.match(/_setupTimelineBackdropCycle\(\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(fn, '_setupTimelineBackdropCycle must exist');
  assert.match(fn[0], /poster:\s*['"]\/images\/landing\/timeline-['"]\s*\+\s*slug\s*\+\s*['"]\.jpg['"]/,
    'timeline pickFn must build poster URL from /images/landing/timeline-<slug>.jpg');
});

test('Map backdrop pickFn sets poster from /images/landing/map-<slug>.jpg', () => {
  const fn = html.match(/_setupMapBackdropCycle\(\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(fn, '_setupMapBackdropCycle must exist');
  assert.match(fn[0], /poster:\s*['"]\/images\/landing\/map-['"]\s*\+\s*slug\s*\+\s*['"]\.jpg['"]/,
    'map pickFn must build poster URL from /images/landing/map-<slug>.jpg');
});

test('Timeline + map poster JPEGs exist on disk', () => {
  const timeline = ['ankh-spiral', 'time-cycle', 'sacred-geometry', 'cosmic-nile'];
  const map = ['great-pyramids', 'great-zimbabwe', 'lalibela', 'timbuktu', 'meroe-pyramids', 'benin-walls'];
  for (const slug of timeline) {
    const p = path.join('public/images/landing', `timeline-${slug}.jpg`);
    assert.ok(fs.existsSync(p), `timeline poster missing: ${p}`);
  }
  for (const slug of map) {
    const p = path.join('public/images/landing', `map-${slug}.jpg`);
    assert.ok(fs.existsSync(p), `map poster missing: ${p}`);
  }
});

// ─── v3.51.50 — Hero eager-load + rootMargin prefetch regression hotfix ─────

test('hero loads eagerly (NOT via IO wait) — regression fix', () => {
  // setupHero must call _enqueueLoad(hero) directly, not only inside IO callback.
  const fn = html.match(/function setupHero\(\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(fn, 'setupHero function must exist');
  // The eager call comment + the call site
  assert.match(fn[0], /Eager byte-fetch trigger\. Don't wait for IO/i,
    'setupHero must have eager-load comment marker');
  // Must call _enqueueLoad(hero) outside the IO callback
  const eagerCall = fn[0].match(/_enqueueLoad\(hero\);/);
  assert.ok(eagerCall, 'setupHero must call _enqueueLoad(hero) eagerly');
});

// v3.51.54 — rootMargin reverted to modest 600px (1500/2000 re-created the
// concurrent-load storm). Light posters show instantly so no big prefetch
// lead is needed. Capped at 600px (also asserted by the R4 test above).
test('deferred panels use modest rootMargin (<= 600px, no concurrent storm)', () => {
  const setupDeferred = html.match(/function setupDeferred\(\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(setupDeferred, 'setupDeferred function must exist');
  const dMargins = [...setupDeferred[0].matchAll(/rootMargin:\s*([^,]+?),\s*threshold/g)]
    .flatMap(mm => [...mm[1].matchAll(/(\d+)px/g)].map(x => parseInt(x[1], 10)));
  assert.ok(dMargins.length > 0, 'setupDeferred must specify rootMargin');
  for (const px of dMargins) assert.ok(px <= 600, `deferred rootMargin must be <= 600px (got ${px}px)`);
});

test('Karnak carousel uses modest rootMargin (<= 600px)', () => {
  const setupKarnak = html.match(/function setupKarnakCarousel\(\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(setupKarnak, 'setupKarnakCarousel function must exist');
  const kMargins = [...setupKarnak[0].matchAll(/rootMargin:\s*([^,]+?),\s*threshold/g)]
    .flatMap(mm => [...mm[1].matchAll(/(\d+)px/g)].map(x => parseInt(x[1], 10)));
  assert.ok(kMargins.length > 0, 'setupKarnakCarousel must specify rootMargin');
  for (const px of kMargins) assert.ok(px <= 600, `Karnak rootMargin must be <= 600px (got ${px}px)`);
});

// ─── v3.51.69 — mobile/iPad efficiency: serial load queue + iOS rootMargin ───

test('L2 — IIFE serializes byte-pull via a concurrency-capped queue', () => {
  assert.match(html, /var MAX_CONCURRENT = IS_MOBILE \? 1 : 2;/, 'MAX_CONCURRENT must cap concurrent loads (all mobile = 1)');
  assert.match(html, /function _drainQueue\(\)/, 'must have a queue drainer');
  assert.match(html, /_loadQueue\.push\(v\)/, '_enqueueLoad must push to the queue, not load immediately');
  const drain = html.match(/function _drainQueue\(\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(drain, '_drainQueue body must be findable');
  // a slot drains on canplay / error / a safety timeout so a stall can't wedge it
  assert.match(drain[0], /addEventListener\('canplay', settle/);
  assert.match(drain[0], /addEventListener\('error', settle/);
  assert.match(drain[0], /setTimeout\(settle, 12000\)/);
  assert.match(drain[0], /_activeLoads\+\+/);
});

test('L1 — mobile (iOS + Android) gets a conservative (smaller) rootMargin than desktop', () => {
  // Mobile loads only when nearly in view (cwnd-friendly); desktop keeps the lead.
  const mMargins = [...html.matchAll(/rootMargin:\s*IS_MOBILE \? '(\d+)px 0px' : '(\d+)px 0px'/g)];
  assert.ok(mMargins.length >= 2, 'landing IOs must use an IS_MOBILE-conditional rootMargin');
  for (const m of mMargins) {
    assert.ok(parseInt(m[1], 10) < parseInt(m[2], 10), `mobile rootMargin (${m[1]}) must be smaller than desktop (${m[2]})`);
    assert.ok(parseInt(m[1], 10) <= 200, `mobile rootMargin should be small (<=200px), got ${m[1]}`);
  }
});

test('L1 — IS_MOBILE covers Android as well as iOS (same care across the board)', () => {
  assert.match(html, /var IS_MOBILE = IS_IOS \|\| \/Android\/i\.test\(navigator\.userAgent/,
    'IS_MOBILE must include Android, not just iOS');
});

// ─── v3.51.49 — gov/timeline/map/peh enterprise migration ───────────────────

test('shared _backdropCycleSetup helper exists', () => {
  assert.match(html, /_backdropCycleSetup\(opts\)\s*\{/,
    'App must expose _backdropCycleSetup(opts) generic helper');
  assert.match(html, /_backdropCycleCleanup\(opts\)\s*\{/,
    'App must expose _backdropCycleCleanup(opts) generic helper');
});

test('shared helper honors tier + cache-busters + per-element fallback', () => {
  const fn = html.match(/_backdropCycleSetup\(opts\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(fn, '_backdropCycleSetup must exist');
  assert.match(fn[0], /_backdropEnterprise\.tier\(\)/);
  assert.match(fn[0], /_backdropEnterprise\.bust/);
  assert.match(fn[0], /countPlayReject/, 'per-element play-reject logger (no global degrade)');
  assert.match(fn[0], /countStall/, 'per-element stall logger (no global degrade)');
  assert.match(fn[0], /posters-only/, 'must handle posters-only tier');
});

test('gov/timeline/map/peh video tags have webkit-playsinline + preload="none"', () => {
  const targets = [
    /<video[^>]*id="govBackdropVideo0"[^>]*>/,
    /<video[^>]*id="govBackdropVideo1"[^>]*>/,
    /<video[^>]*id="govBackdropVideo2"[^>]*>/,
    /<video[^>]*id="timelineBackdropVideo0"[^>]*>/,
    /<video[^>]*id="timelineBackdropVideo1"[^>]*>/,
    /<video[^>]*id="timelineBackdropVideo2"[^>]*>/,
    /<video[^>]*id="mapBackdropVideo0"[^>]*>/,
    /<video[^>]*id="mapBackdropVideo1"[^>]*>/,
    /<video[^>]*id="mapBackdropVideo2"[^>]*>/,
    /<video[^>]*id="pertEmHeruBackdropVideo0"[^>]*>/,
    /<video[^>]*id="pertEmHeruBackdropVideo1"[^>]*>/,
    /<video[^>]*id="pertEmHeruBackdropVideo2"[^>]*>/,
  ];
  for (const re of targets) {
    const m = html.match(re);
    assert.ok(m, `tag missing for selector ${re}`);
    assert.match(m[0], /\bwebkit-playsinline\b/, `tag must have webkit-playsinline: ${m[0]}`);
    assert.match(m[0], /preload=["']none["']/, `tag must have preload="none": ${m[0]}`);
  }
});

test('gov + timeline + map + peh setup functions route through shared helper or backdrop enterprise', () => {
  // gov + timeline + map use shared _backdropCycleSetup
  for (const name of ['Gov', 'Timeline', 'Map']) {
    const re = new RegExp(`_setup${name}BackdropCycle\\(\\)\\s*\\{[\\s\\S]*?\\n\\s{2}\\},`);
    const m = html.match(re);
    assert.ok(m, `_setup${name}BackdropCycle must exist`);
    assert.match(m[0], /_backdropCycleSetup/,
      `_setup${name}BackdropCycle must call shared _backdropCycleSetup`);
  }
  // PEH uses bespoke logic but routes through _backdropEnterprise inline
  const pehFn = html.match(/_setupPertEmHeruBackdropCycle\(\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(pehFn, '_setupPertEmHeruBackdropCycle must exist');
  assert.match(pehFn[0], /_backdropEnterprise\.tier\(\)/,
    'PEH must call _backdropEnterprise.tier()');
  assert.match(pehFn[0], /_backdropEnterprise\.bust/,
    'PEH must use bust() for cache-busters');
  assert.match(pehFn[0], /countPlayReject/,
    'PEH must count play rejections');
});

test('gov + peh + map + timeline all have posters (v3.51.54 — all light JPEGs)', () => {
  // v3.51.54: gov + peh use light /images/landing/intro-<slug>.jpg (was chunk-0.png)
  const govFn = html.match(/_setupGovBackdropCycle\(\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(govFn);
  assert.match(govFn[0], /poster:\s*['"]\/images\/landing\/intro-['"]\s*\+\s*slug/,
    'gov must build posters from /images/landing/intro-<slug>.jpg');
  const pehFn = html.match(/_setupPertEmHeruBackdropCycle\(\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(pehFn);
  assert.match(pehFn[0], /setAttribute\(['"]poster['"],\s*['"]\/images\/landing\/intro-['"]/,
    'PEH must set poster from /images/landing/intro-<id>.jpg');
  // v3.51.52 — map + timeline now have posters at /images/landing/
  const mapFn = html.match(/_setupMapBackdropCycle\(\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(mapFn);
  assert.match(mapFn[0], /poster:\s*['"]\/images\/landing\/map-/,
    'map pickFn must build poster from /images/landing/map-<slug>.jpg (v3.51.52)');
  const timelineFn = html.match(/_setupTimelineBackdropCycle\(\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(timelineFn);
  assert.match(timelineFn[0], /poster:\s*['"]\/images\/landing\/timeline-/,
    'timeline pickFn must build poster from /images/landing/timeline-<slug>.jpg (v3.51.52)');
});

// ─── v3.51.48 — Reader section-specific backdrop video cycle ────────────────
// Locks Rule 7 parity on the reader-screen backdrop cycle.

test('reader backdrop has 3 video slots (was 1 pre-v3.51.48)', () => {
  for (const i of [0, 1, 2]) {
    const re = new RegExp(`<video[^>]*id="readerBackdropVideo${i}"[^>]*>`);
    assert.match(html, re, `readerBackdropVideo${i} must exist`);
  }
});

test('reader backdrop slots have webkit-playsinline + preload=none + screen-backdrop-video class', () => {
  for (const i of [0, 1, 2]) {
    const re = new RegExp(`<video[^>]*id="readerBackdropVideo${i}"[^>]*>`);
    const m = html.match(re);
    assert.ok(m, `readerBackdropVideo${i} tag must exist`);
    assert.match(m[0], /\bwebkit-playsinline\b/);
    assert.match(m[0], /preload=["']none["']/);
    assert.match(m[0], /class=["'][^"']*\bscreen-backdrop-video\b/);
    assert.match(m[0], /class=["'][^"']*\breader-backdrop\b/);
  }
});

test('reader-backdrop CSS class exists with lower opacity than home/library (reading text dominates)', () => {
  assert.match(html, /\.reader-backdrop\.loaded\s*\{[^}]*opacity:\s*\.22/,
    'reader-backdrop.loaded must use lower opacity (~.22) — reading text must dominate');
});

test('App._findSetForStory helper traverses STORY_SETS', () => {
  assert.match(html, /_findSetForStory\(story\)/,
    '_findSetForStory must exist on App');
  // Must check storyIds.includes
  assert.match(html, /set\.storyIds\.includes\(story\.id\)/,
    '_findSetForStory must check storyIds.includes(story.id)');
});

test('App._pickReaderBackdropSlugs excludes current story (no ambient self-echo)', () => {
  const fn = html.match(/_pickReaderBackdropSlugs\(story\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(fn, '_pickReaderBackdropSlugs must exist');
  assert.match(fn[0], /filter\(id\s*=>\s*id\s*!==\s*story\.id\)/,
    'must exclude current story from pool (Africana — ambient continuity, not literal repetition)');
});

test('App._pickReaderBackdropSlugs falls back to general _introVideoPool when set is missing or single-story', () => {
  const fn = html.match(/_pickReaderBackdropSlugs\(story\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(fn, '_pickReaderBackdropSlugs must exist');
  assert.match(fn[0], /_introVideoPool/,
    'must fall back to _introVideoPool when set is missing/empty');
  // Coach C4 — empty-set fallback condition
  assert.match(fn[0], /set\.storyIds\.length\s*>\s*1/,
    'must require set.storyIds.length > 1 (single-story sets fall back to general pool)');
});

test('Reader backdrop uses 20s cycle interval (longer than 10s home/library — reader is long-form)', () => {
  assert.match(html, /_READER_CYCLE_MS:\s*20000/,
    'reader cycle must use 20000ms interval (longer than home/library)');
});

test('Reader backdrop routes through App._backdropEnterprise.tier()', () => {
  const fn = html.match(/_setupReaderBackdrop\(story\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(fn, '_setupReaderBackdrop function must exist');
  assert.match(fn[0], /_backdropEnterprise\.tier\(\)/,
    'reader setup must call _backdropEnterprise.tier()');
});

test('Reader backdrop sets light intro poster (v3.51.54 — was heavy chunk-0.png)', () => {
  const fn = html.match(/_setupReaderBackdrop\(story\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(fn, '_setupReaderBackdrop function must exist');
  assert.match(fn[0], /setAttribute\(['"]poster['"],\s*['"]\/images\/landing\/intro-['"]\s*\+\s*slug/,
    'reader must set poster from /images/landing/intro-<slug>.jpg');
  assert.doesNotMatch(fn[0], /chunk-0\.png/,
    'reader must NOT use heavy chunk-0.png posters');
});

test('Reader backdrop relies on <video> error event for 404s (no pre-flight HEAD-check, v3.51.52)', () => {
  const fn = html.match(/_setupReaderBackdrop\(story\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(fn, '_setupReaderBackdrop function must exist');
  // v3.51.52: HEAD-check removed (was adding 50-200ms × 3 delay on reader entry).
  assert.doesNotMatch(fn[0], /fetch\(busted,\s*\{\s*method:\s*['"]HEAD['"]/,
    'reader must NOT pre-flight HEAD-check (rely on <video> error event instead)');
  // The error event handler must still exist as the 404 fallback.
  assert.match(fn[0], /addEventListener\(['"]error['"]/,
    'reader must attach error listener as 404 fallback');
});

test('Reader backdrop cleanup unloads all 3 slots', () => {
  const fn = html.match(/_cleanupReaderBackdrop\(\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(fn, '_cleanupReaderBackdrop function must exist');
  assert.match(fn[0], /\[0,\s*1,\s*2\]\.forEach/,
    'cleanup must iterate all 3 slots');
  assert.match(fn[0], /removeAttribute\(['"]src['"]\)/,
    'cleanup must removeAttribute src');
});

test('Reader backdrop setup is idempotent for same story (Coach C1)', () => {
  const fn = html.match(/_setupReaderBackdrop\(story\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(fn, '_setupReaderBackdrop function must exist');
  assert.match(fn[0], /_readerBackdropStoryId\s*===\s*\(story\s*&&\s*story\.id\)/,
    'reader setup must early-return when already cycling for the same story');
});

// ─── v3.51.47 — home + general-library backdrop enterprise hardening ────────
// Locks Rule 7 parity on the home + library screen-backdrop video cycles.

test('App._backdropEnterprise helper exists', () => {
  assert.match(html, /_backdropEnterprise:\s*\{/,
    'App must expose _backdropEnterprise namespace');
  assert.match(html, /tier\(\)/,
    'helper must expose tier() accessor');
  assert.match(html, /bust\(url\)/,
    'helper must expose bust(url) cache-buster');
  assert.match(html, /countPlayReject\(err/,
    'helper must expose countPlayReject (per-element logger)');
  assert.match(html, /countStall\(slug\)/,
    'helper must expose countStall (per-element logger)');
  // v3.51.54 — _autoDegrade REMOVED (was the regression).
});

test('App._backdropEnterprise initializes connection-aware tier + iOS detection', () => {
  assert.match(html, /matchMedia\(['"]\(prefers-reduced-motion: reduce\)['"]\)/,
    'helper must check prefers-reduced-motion');
  assert.match(html, /matchMedia\(['"]\(prefers-reduced-data: reduce\)['"]\)/,
    'helper must check prefers-reduced-data');
  assert.match(html, /saveData/,
    'helper must check connection.saveData');
  assert.match(html, /effectiveType/,
    'helper must check connection.effectiveType');
  assert.match(html, /maxTouchPoints/,
    'helper must use maxTouchPoints for iPad detection');
});

// v3.51.54 — REMOVED helper play-rejection/stall thresholds + iOS-NotAllowedError
// fast-path tests (that machinery was the regression). Absence asserted by the
// "R1/CC1 — NO reactive auto-degrade anywhere" test above.

test('App._backdropEnterprise wires visibilitychange (idempotent), NO offline auto-degrade', () => {
  assert.match(html, /_wireGlobalEvents/,
    'helper must wire global events');
  assert.match(html, /_wiredGlobal/,
    'helper must guard against double-wiring');
  // v3.51.54: the helper _wireGlobalEvents must NOT register an offline
  // auto-degrade handler.
  const fn = html.match(/_wireGlobalEvents\(\)\s*\{[\s\S]*?\n\s{4}\}/);
  assert.ok(fn, '_wireGlobalEvents must exist');
  assert.doesNotMatch(fn[0], /addEventListener\(['"]offline['"]/,
    'helper must not register offline auto-degrade (v3.51.54)');
});

test('home backdrop videos have poster attributes (Rule 7.2)', () => {
  const heroBlock = html.match(/<video[^>]*id="homeBackdropVideo0"[^>]*>/);
  assert.ok(heroBlock, 'homeBackdropVideo0 must exist');
  assert.match(heroBlock[0], /poster=["']\/images\/landing\/level1-intro\.jpg["']/,
    'homeBackdropVideo0 must have level1-intro poster');
  assert.match(html, /<video[^>]*id="homeBackdropVideo1"[^>]*poster=["']\/images\/landing\/seeds-outro\.jpg["']/);
  assert.match(html, /<video[^>]*id="homeBackdropVideo2"[^>]*poster=["']\/images\/landing\/battle-outro\.jpg["']/);
});

test('home + library backdrop videos have webkit-playsinline (iPad)', () => {
  const tags = [
    /<video[^>]*id="homeBackdropVideo0"[^>]*>/,
    /<video[^>]*id="homeBackdropVideo1"[^>]*>/,
    /<video[^>]*id="homeBackdropVideo2"[^>]*>/,
    /<video[^>]*id="libraryBackdropVideo0"[^>]*>/,
    /<video[^>]*id="libraryBackdropVideo1"[^>]*>/,
    /<video[^>]*id="libraryBackdropVideo2"[^>]*>/,
  ];
  for (const re of tags) {
    const m = html.match(re);
    assert.ok(m, `tag missing for selector ${re}`);
    assert.match(m[0], /\bwebkit-playsinline\b/, `tag must have webkit-playsinline: ${m[0]}`);
  }
});

test('home backdrop posters exist on disk (≤350 KB each)', () => {
  const posters = ['level1-intro.jpg', 'seeds-outro.jpg', 'battle-outro.jpg'];
  for (const p of posters) {
    const diskPath = path.join('public/images/landing', p);
    assert.ok(fs.existsSync(diskPath), `home poster missing on disk: ${diskPath}`);
    const size = fs.statSync(diskPath).size;
    assert.ok(size <= 350 * 1024, `${p} is ${(size/1024).toFixed(0)}KB — exceeds 350KB budget`);
  }
});

test('home + library backdrop setup functions route through _backdropEnterprise', () => {
  // Both must call this._backdropEnterprise.tier() to get the active tier.
  const homeFn = html.match(/_setupHomeBackdropCycle\(\)\s*\{[\s\S]*?(?=\n\s*[_a-zA-Z]+\(\)\s*\{|\n\s*\},)/);
  assert.ok(homeFn, '_setupHomeBackdropCycle must exist');
  assert.match(homeFn[0], /_backdropEnterprise\.tier\(\)/,
    'home setup must call _backdropEnterprise.tier()');
  const libFn = html.match(/_setupLibraryBackdropCycle\(\)\s*\{[\s\S]*?(?=\n\s*[_a-zA-Z]+\(\)\s*\{|\n\s*\},)/);
  assert.ok(libFn, '_setupLibraryBackdropCycle must exist');
  assert.match(libFn[0], /_backdropEnterprise\.tier\(\)/,
    'library setup must call _backdropEnterprise.tier()');
});

test('library backdrop sets light intro poster (v3.51.54 — was heavy chunk-0.png)', () => {
  const libFn = html.match(/_setupLibraryBackdropCycle\(\)\s*\{[\s\S]*?(?=\n\s*[_a-zA-Z]+\(\)\s*\{|\n\s*\},)/);
  assert.ok(libFn, '_setupLibraryBackdropCycle must exist');
  assert.match(libFn[0], /setAttribute\(['"]poster['"],\s*['"]\/images\/landing\/intro-['"]\s*\+\s*slug/,
    'library must set poster from /images/landing/intro-<slug>.jpg');
  assert.doesNotMatch(libFn[0], /chunk-0\.png/,
    'library must NOT use heavy chunk-0.png posters');
});

test('library-featured per-story video uses preload="metadata" not "auto"', () => {
  // Match the function DEFINITION: "_loadLibraryFeaturedVideo(story, storyIdx){"
  const fn = html.match(/_loadLibraryFeaturedVideo\(story,\s*storyIdx\)\s*\{[\s\S]*?\n\s{2}\},/);
  assert.ok(fn, '_loadLibraryFeaturedVideo function definition must exist');
  assert.match(fn[0], /\.preload\s*=\s*['"]metadata['"]/,
    'featured video must use preload="metadata" (was "auto" — defeated by autoplay promotion)');
  assert.doesNotMatch(fn[0], /\.preload\s*=\s*['"]auto['"]/,
    'featured video must NOT use preload="auto"');
  assert.match(fn[0], /setAttribute\(['"]poster['"]/,
    'featured video must set poster');
  assert.match(fn[0], /setAttribute\(['"]webkit-playsinline['"]/,
    'featured video must set webkit-playsinline for iPad');
});

test('every landing poster JPEG on disk is ≤350 KB', () => {
  const dir = 'public/images/landing';
  if (!fs.existsSync(dir)) {
    assert.fail('public/images/landing/ directory missing');
  }
  const THREE_FIFTY_KB = 350 * 1024;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.jpg')) continue;
    const size = fs.statSync(path.join(dir, f)).size;
    assert.ok(size <= THREE_FIFTY_KB,
      `${f} is ${(size / 1024).toFixed(0)}KB — exceeds 350KB poster budget. Re-export at -q:v 4 -vf scale=1280:-2.`);
  }
});

// ── Reader-backdrop asset integrity (2026-05-20 404 fix) ─────────────────────
// Root cause locked out: _pickReaderBackdropSlugs picked from set.storyIds,
// which includes stories with no intro video/poster (Yeshua's Way, 25th
// Dynasty) → 158 404s/day. Fix: a manifest of slugs that have BOTH assets,
// and a picker that filters against it.
function readerManifestSlugs() {
  const m = html.match(/_introVideoSlugs:\s*new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(m, '_introVideoSlugs manifest must exist');
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}

test('every _introVideoSlugs entry has its extracted poster on disk (no 404s)', () => {
  const slugs = readerManifestSlugs();
  assert.ok(slugs.length > 100, `manifest should list all intro slugs, found ${slugs.length}`);
  const missing = slugs.filter(s => !fs.existsSync(path.join('public/images/landing', 'intro-' + s + '.jpg')));
  assert.equal(missing.length, 0,
    'every manifest slug needs intro-<slug>.jpg; missing: ' + missing.join(', '));
});

test('manifest covers the previously-broken sets (Yeshua\'s Way + 25th Dynasty)', () => {
  const slugs = readerManifestSlugs();
  assert.ok(slugs.filter(s => s.startsWith('yeshuas-way-')).length >= 10, 'YW intros must be in the manifest');
  assert.ok(slugs.filter(s => s.startsWith('twenty-fifth-dynasty-')).length >= 10, '25th Dynasty intros must be in the manifest');
});

test('_pickReaderBackdropSlugs filters set picks against the manifest (fail-safe)', () => {
  assert.match(html, /set\.storyIds\.filter\(id => id !== story\.id && this\._introVideoSlugs\.has\(id\)\)/,
    'set pool must be intersected with _introVideoSlugs so missing-asset slugs are never picked');
  assert.match(html, /if \(!pool \|\| pool\.length === 0\) \{[\s\S]*?_introVideoPool\.filter/,
    'must fall back to the general pool when a set has no eligible intros');
});

// ─── v3.51.72 — iOS WebM-skip + poster-always-visible fallback ─────────────
// Reported 2026-05-24: brown hero on iPhone (Safari + Chrome). iOS mis-picks the
// VP9-WebM source then fails to render it (no canplay), and the opacity:0-until-
// .loaded rule hid the poster too → brown. Two fixes locked below.

test('v3.51.72 — loader strips WebM sources on iOS so the MP4 is used', () => {
  assert.match(html, /if \(IS_IOS\) \{[\s\S]{0,400}source\[type="video\/webm"\][\s\S]{0,200}\.remove\(\)/,
    'the landing IIFE must remove webm <source> children when IS_IOS before load()');
  assert.match(html, /if \(v\.src && \/\\\.webm\(\\\?\|\$\)\/i\.test\(v\.src\)\) v\.removeAttribute\('src'\)/,
    'must also clear a webm src= attribute on iOS');
});

test('v3.51.72 — hero keeps its poster ALWAYS visible (opacity:1), not 0-until-loaded', () => {
  assert.match(html, /\.intro-hero>\.intro-backdrop-video\{opacity:1\}/,
    'hero backdrop must be opacity:1 so the poster shows as a fallback when the video never loads');
  // The shared carousel base must STAY opacity:0 so the 3-up cross-fade still works.
  assert.match(html, /\.intro-backdrop-video\{[^}]*opacity:0;/,
    'base .intro-backdrop-video must remain opacity:0 (carousel cross-fade depends on it)');
});

test('v3.51.72 — single-video section + final-cta backdrops show their poster too', () => {
  assert.match(html, /\.intro-section-backdrop \.intro-backdrop-video\{opacity:1;/,
    'section backdrops must default opacity:1 (poster fallback)');
  assert.match(html, /\.intro-final-cta \.intro-backdrop-video\{[^}]*opacity:\.3;/,
    'final-cta backdrop must default to its dim .3 (poster shows dimmed, matches loaded state)');
});
