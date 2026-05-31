#!/usr/bin/env node
// v3.44.0 — Parent video feed enterprise hardening regression test.
// Source-pattern locks the four pillars of the resilience fix:
//   1. getYtDlpBin() lazy-resolver with re-check at spawn time
//   2. Disk cache hydrate + persist
//   3. Stale-fallback response shape (200 + error + cached videos)
//   4. Structured telemetry with event + requestId fields

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const serverSrc = fs.readFileSync('server.js', 'utf8');
const html = fs.readFileSync('maat-reader.html', 'utf8');

test('v3.44.0 — getYtDlpBin priority-aware resolver iterates candidates from top each call', () => {
  assert.match(serverSrc, /function getYtDlpBin\(\)/,
    'getYtDlpBin function defined');
  assert.match(serverSrc, /YT_DLP_BIN_CANDIDATES\s*=\s*\[/,
    'candidate array exists');
  // Voice 2 fix: iterate candidates from top every call, NOT cache+revalidate
  // (that pattern would hold the original binary when a higher-priority one
  // is installed AFTER server start).
  const m = serverSrc.match(/function getYtDlpBin\(\)\s*\{[\s\S]+?\n\}/);
  assert.ok(m, 'getYtDlpBin body found');
  assert.match(m[0], /for\s*\(\s*const\s+p\s+of\s+YT_DLP_BIN_CANDIDATES/,
    'iterates candidate list each call');
  // No early-return-on-cached-path BEFORE the loop (otherwise priority is broken).
  // v3.51.x: a validated-path cache (_ytDlpValidated) was added INSIDE the loop,
  // AFTER the per-candidate existsSync check — so iteration still starts from the
  // top each call and a higher-priority binary installed later is still picked up.
  // The cache only skips the repeat --version spawn for an already-proven path.
  assert.doesNotMatch(m[0], /if\s*\(\s*_ytDlpBinResolved\s*&&\s*fs\.existsSync\(_ytDlpBinResolved\)\s*\)\s*return/,
    'NO cached-path early-return before the candidate loop (Voice 2 binding)');
  assert.match(serverSrc, /process\.env\.YT_DLP_BIN/,
    'env override honored');
  // Logs only when resolution CHANGES (not on every call — would be log noise)
  assert.match(m[0], /console\.log\([^)]*\[yt-dlp\][^)]*resolved \+ validated binary/,
    'logs resolved path on change');
});

test('v3.44.0 — fetchChannelFlat re-resolves YT_DLP_BIN at spawn time', () => {
  // Ensures a stale module-load resolution can't permanently break the feed.
  const m = serverSrc.match(/function fetchChannelFlat\([^)]*\)\s*\{[\s\S]+?\n\}/);
  assert.ok(m, 'fetchChannelFlat body found');
  assert.match(m[0], /const bin\s*=\s*getYtDlpBin\(\)/,
    'fetchChannelFlat calls getYtDlpBin() each invocation');
  assert.match(m[0], /spawn\(bin,/, 'spawn uses the lazily resolved bin');
});

test('v3.44.0 — disk cache hydrate + persist functions exist', () => {
  assert.match(serverSrc, /LEARN_MORE_DISK_CACHE\s*=/, 'disk cache path constant');
  assert.match(serverSrc, /function hydrateLearnMoreFromDisk\(\)/,
    'hydrate function defined');
  assert.match(serverSrc, /function persistLearnMoreToDisk\(/,
    'persist function defined');
  // Hydrate is called at module load
  assert.match(serverSrc, /hydrateLearnMoreFromDisk\(\);/,
    'hydrate invoked at boot');
});

test('v3.44.0 — feed endpoint serves stale cache with error banner instead of 503', () => {
  // The endpoint must NOT 503 when there's a usable in-memory or disk cache.
  // It returns 200 with `error` field set so the UI can show a banner.
  // v3.44.5 — assertions check the entire server.js (route + helper) rather
  // than just the inline route body, since response-shaping was extracted
  // into _serveLearnMoreFromResults for the in-flight dedup path.
  assert.match(serverSrc, /source:\s*['"]stale_fallback['"]/,
    'stale_fallback source label set on response');
  assert.match(serverSrc, /error:\s*['"]Live feed unavailable/,
    'user-facing error banner copy present');
  assert.match(serverSrc, /event:['"]cold_start_failure['"]/,
    'cold-start-failure event emitted before 503');
  // The route OR the helper must produce a 503 path
  assert.match(serverSrc, /res\.status\(503\)/, '503 path exists');
});

test('v3.44.0 — structured telemetry with requestId + event fields on every code path', () => {
  // requestId generated in the route, all events emitted across route + helper
  assert.match(serverSrc, /const requestId\s*=/, 'requestId variable defined in route');
  for (const evt of ['cache_hit', 'fresh_fetch_ok', 'fresh_empty_serving_stale', 'cold_start_failure', 'unexpected_error']) {
    assert.match(serverSrc, new RegExp(`event:['"]${evt}['"]`),
      `event label "${evt}" emitted`);
  }
});

test('v3.44.5 — in-flight promise dedup (single-flight pattern)', () => {
  // _learnMoreInFlight module-level promise + inflight_join branch in route
  assert.match(serverSrc, /let\s+_learnMoreInFlight\s*=\s*null/,
    '_learnMoreInFlight module-level state declared');
  assert.match(serverSrc, /event:['"]inflight_join['"]/,
    'inflight_join event emitted when joining in-flight promise');
  // Owner path uses try/finally to clear the in-flight reference
  assert.match(serverSrc, /finally\s*\{\s*_learnMoreInFlight\s*=\s*null/,
    'in-flight promise is cleared in finally (no leaked state on error)');
  // Response-shaping helper extracted (DRY between owner + joiner paths)
  assert.match(serverSrc, /function\s+_serveLearnMoreFromResults\s*\(/,
    'response-shaping helper extracted for owner + joiner path reuse');
});

test('v3.44.0 — frontend renderLearnMoreLibrary surfaces error banner + Retry button', () => {
  // Empty-videos path renders a Retry button with a click handler
  // that re-invokes renderLearnMoreLibrary(true).
  const renderBlock = html.match(/async renderLearnMoreLibrary[\s\S]+?\n  \},/);
  assert.ok(renderBlock, 'renderLearnMoreLibrary body found');
  const body = renderBlock[0];
  // Retry button on the empty-videos path
  assert.match(body, /retryBtn\.textContent\s*=\s*['"]Try again['"]/,
    'Retry button labeled');
  assert.match(body, /retryBtn\.onclick\s*=\s*\(\)\s*=>\s*\{[\s\S]{0,200}?renderLearnMoreLibrary\(true\)/,
    'Retry button re-invokes renderLearnMoreLibrary(true)');
  // Server's error message is surfaced verbatim (not silently overridden)
  assert.match(body, /\(data\s*&&\s*data\.error\)\s*\|\|/,
    'data.error string used as primary user-facing message');
  // Stale-fallback path uses the warn class on the status element
  assert.match(body, /lm-feed-status warn/,
    'staleness CSS class applied when serving stale data');
});

test('v3.44.0 — staleness banner CSS class defined', () => {
  assert.match(html, /\.lm-feed-status\.warn\s*\{[^}]*color:\s*var\(--gold\)/,
    '.lm-feed-status.warn rule with gold accent');
});
