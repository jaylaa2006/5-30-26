// v3.51.73 — Response Log content discipline (2026-05-27)
//
// Root cause locked in by this test:
//   user.responseLog was being used as BOTH the parent-visible per-child
//   reflection journal AND a free-for-all telemetry sink (heka mic events,
//   sema pair completions, heka completion markers, heka_started /
//   heka_typing_opened / heka_azure_error / heka_first_interim /
//   heka_first_confirm / heka_completed / heka_azure_circuit_tripped /
//   heka_timeout_no_speech / heka_permission_denied_live / heka_rec_error
//   / heka_azure_start_failed / etc.).
//
// `lib/merge-user-data.mjs::capLogArrays` caps the array at 500 entries
// (slice(-500)). A noisy mic session can produce a dozen+ telemetry events
// in seconds. Result on the production King account, prior to this fix:
//   500 entries / 0 reflection-type / 100% telemetry — every Maat
//   reflection had been evicted out the back of the cap.
//
// The dashboard render (`_renderGuardianResponseLog`) filters to
// type='reflection' or no-type, so the parent saw nothing from local —
// and when the server fetch silently caught a failure, the parent saw
// stale data or nothing without any visible signal.
//
// This test prevents the regression class:
//   1) responseLog.push (via PerAnkhGuardian.logResponse) never carries a
//      heka* or sema type. Real per-child signal only.
//   2) The dashboard filter accepts the agreed type set
//      ['reflection','dialogue','challenge','override'] and rejects the
//      noise types ['sema','heka'].
//   3) _fetchServerReflections is not a silent catch — it logs the error
//      and sets _serverReflectionsError so the dashboard can surface it.
//   4) The parent dashboard renders an explicit "couldn't load" banner
//      with a retry affordance when the server fetch fails.
//   5) /api/seba-evaluate skips insertReflection when the request is not
//      authenticated, so reflections never end up bucketed under an
//      anon_<ip> google_id where the requireAuth dashboard query can't
//      see them (this also closes a cross-family IP-bucket pollution
//      surface flagged in the v3.51.73 Stage-1 RT security voice).
//   6) Weekly-email `weekResponses` filters by reflection-type so the
//      digest count isn't inflated by what telemetry remains in older
//      cloud blobs (until those naturally age out).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');
const api  = fs.readFileSync('seba-story-api.mjs', 'utf8');

test('Rule 1 — PerAnkhGuardian.logResponse callsites carry no heka* or sema types', () => {
  // Find every logResponse call and inspect the next ~400 chars for `type:`.
  const offenders = [];
  const re = /PerAnkhGuardian\.logResponse\s*\(/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const start = m.index;
    const slice = html.slice(start, start + 600);
    // Allow either `type: 'X'` or `type:'X'` (some inline calls are tight).
    const tm = slice.match(/type\s*:\s*['"]([^'"]+)['"]/);
    if (!tm) continue; // unparseable / dynamic — flagged separately below
    const t = tm[1];
    if (/^heka/i.test(t) || t === 'sema') {
      offenders.push({ offset: start, type: t });
    }
  }
  assert.equal(offenders.length, 0,
    'responseLog must not carry heka*/sema entries (telemetry, not per-child reflection signal):\n' +
    offenders.map(o => `  - offset ${o.offset}: type=${o.type}`).join('\n'));
});

test('Rule 2 — PerAnkhGuardian.logResponse never carries a dynamic heka_+status type', () => {
  // Catches the `_logHekaEvent` regression specifically — it was building
  // `type: 'heka_' + status` programmatically. Forbid that pattern outright.
  const offenders = [];
  const re = /PerAnkhGuardian\.logResponse\s*\(/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const start = m.index;
    const slice = html.slice(start, start + 600);
    if (/type\s*:\s*['"]heka_['"]\s*\+/.test(slice) ||
        /type\s*:\s*`heka_/.test(slice)) {
      offenders.push({ offset: start });
    }
  }
  assert.equal(offenders.length, 0,
    'dynamic `type: "heka_" + status` is the original v3.51.73 root cause — telemetry must not be logResponsed:\n' +
    offenders.map(o => `  - offset ${o.offset}`).join('\n'));
});

test('Rule 3 — dashboard accepts the agreed reflection-type allow-list', () => {
  // The contract: per-child typed-signal types pass; noise types are rejected.
  // Look for the canonical RESPONSE_LOG_ALLOW set defined near the render fn.
  assert.ok(/RESPONSE_LOG_ALLOW\s*=\s*new Set\(\s*\[\s*['"]reflection['"]\s*,\s*['"]dialogue['"]\s*,\s*['"]challenge['"]\s*,\s*['"]override['"]\s*\]\s*\)/.test(html),
    'expected RESPONSE_LOG_ALLOW = new Set([\'reflection\',\'dialogue\',\'challenge\',\'override\']) constant in maat-reader.html');
  // v3.51.73 Stage-2 Coach C9 — exact-set assertion so a future contributor
  // can't sneak 'sema' or 'heka' into the allow-list and pass this test.
  const m = html.match(/RESPONSE_LOG_ALLOW\s*=\s*new Set\(\s*(\[[^\]]+\])\s*\)/);
  assert.ok(m, 'RESPONSE_LOG_ALLOW literal must be parseable');
  const members = JSON.parse(m[1].replace(/'/g, '"'));
  assert.deepEqual(members.sort(), ['challenge','dialogue','override','reflection'].sort(),
    'RESPONSE_LOG_ALLOW must be EXACTLY [reflection,dialogue,challenge,override] — no sema/heka leak');
});

test('Rule 4 — _fetchServerReflections logs on error AND sets _serverReflectionsError', () => {
  // Slice out the _fetchServerReflections function body.
  const idx = html.indexOf('_fetchServerReflections');
  assert.ok(idx > 0, '_fetchServerReflections must exist');
  // Walk forward 3500 chars (function body fits comfortably).
  const body = html.slice(idx, idx + 3500);
  // No silent catch — must log and must set the error flag.
  assert.match(body, /console\.(error|warn)\s*\(\s*['"]\[parent\] reflections fetch failed/,
    '_fetchServerReflections must console.error/warn its failure (Rule 1 — no silent catch)');
  assert.match(body, /this\._serverReflectionsError\s*=/,
    '_fetchServerReflections must set _serverReflectionsError so the dashboard can surface the failure');
});

test('Rule 5 — _renderGuardianResponseLog surfaces a retryable error banner', () => {
  // Find the actual function DEFINITION (the parameter form), not the first
  // mention of the name (which is the .then() callback inside
  // _fetchServerReflections).
  const idx = html.indexOf('_renderGuardianResponseLog(u){');
  assert.ok(idx > 0, '_renderGuardianResponseLog(u){ definition must exist');
  const body = html.slice(idx, idx + 10000);
  // Banner present, role=alert, retry button calls a retry method that
  // re-arms the fetch (clears the cache + error + re-renders).
  assert.match(body, /role=["']alert["']/,
    'error banner must carry role="alert" (a11y)');
  assert.match(body, /_retryServerReflections/,
    'banner must wire a Retry button to _retryServerReflections');
  // Filter expansion: the comment-tag drop list still applies to sema/heka,
  // but reflection/dialogue/challenge/override must all pass through.
  assert.match(body, /RESPONSE_LOG_ALLOW\.has/,
    'render must consult the RESPONSE_LOG_ALLOW set, not the legacy "type === reflection" check');
});

test('Rule 6 — _retryServerReflections is defined and clears + re-fetches', () => {
  const idx = html.indexOf('_retryServerReflections');
  assert.ok(idx > 0, '_retryServerReflections must exist');
  const body = html.slice(idx, idx + 600);
  assert.match(body, /this\._serverReflectionsError\s*=\s*null/,
    'retry must clear the prior error flag');
  assert.match(body, /this\._reflectionsFetchedAt\s*=\s*0/,
    'retry must invalidate the 60s fetch cache so the next render re-pulls');
});

test('Rule 7 — _authHeaders fallback removed (server does not honor X-Auth-Id)', () => {
  // The fallback used to send X-Auth-Id, which the server ignored — a footgun
  // that made the request LOOK authenticated to the client while actually
  // landing on the optionalAuth anon_<ip> path. Now: only send auth headers
  // when a real JWT is present; otherwise send no auth (and the server's
  // requireAuth routes return a clean 401).
  const idx = html.indexOf('_authHeaders(){');
  assert.ok(idx > 0, '_authHeaders must exist');
  const body = html.slice(idx, idx + 500);
  assert.doesNotMatch(body, /X-Auth-Id/,
    '_authHeaders must not send X-Auth-Id — the server does not honor it');
});

test('Rule 8 — /api/seba-evaluate skips insertReflection when unauthenticated', () => {
  // The optionalAuth route was bucketing rows under anon_<ip> google_ids that
  // (a) the parent dashboard can never see (requireAuth scope mismatch) and
  // (b) cross-pollute families behind a shared IP. Guard the INSERT on the
  // authenticated flag, not on req.authId alone (which is always set by the
  // anon_<ip> fallback).
  const idx = api.indexOf("app.post('/api/seba-evaluate'");
  assert.ok(idx > 0, '/api/seba-evaluate route must exist');
  // Find the insertReflection block scope (stmt.insertReflection.run).
  const evalEnd = api.indexOf("app.post('/api/", idx + 100);
  const route = api.slice(idx, evalEnd > 0 ? evalEnd : idx + 30000);
  const insertIdx = route.indexOf('stmt.insertReflection.run');
  assert.ok(insertIdx > 0, 'insertReflection must be present in /api/seba-evaluate');
  // Within ~600 chars BEFORE the insert call, an isAuthenticated guard must exist.
  const preInsert = route.slice(Math.max(0, insertIdx - 800), insertIdx);
  assert.match(preInsert, /req\.isAuthenticated/,
    'the insertReflection block must guard on req.isAuthenticated (Stage-1 Security voice)');
});

test('Rule 9 — weekly-email weekResponses is filtered to per-child signal types', () => {
  // The weekly-email weekResponses count was being inflated by heka/sema
  // telemetry. After the fix, even an older cloud blob (still carrying
  // legacy noise) renders a correct count. Look for a RESPONSE_LOG_TYPES /
  // reflection-type filter applied to weekResponses.
  const idx = api.indexOf('const weekResponses');
  assert.ok(idx > 0, 'weekResponses constant must exist in seba-story-api.mjs');
  const body = api.slice(idx, idx + 400);
  // Either explicit allow-list check, or a `(r.type === "reflection" || r.type === "dialogue" || !r.type)` shape.
  const hasAllowList =
    /RESPONSE_LOG_ALLOW(?:_TYPES)?/.test(body) ||
    /r\.type\s*===\s*['"]reflection['"]/.test(body) ||
    /\['reflection',\s*'dialogue'/.test(body);
  assert.ok(hasAllowList,
    'weekResponses must filter to reflection-type entries (not raw responseLog) so the digest count is not inflated by telemetry');
});
