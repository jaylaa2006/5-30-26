#!/usr/bin/env node
// tests/elder-hint-telemetry.test.mjs
// Integration test for POST /api/telemetry/elder-hint (Elder Hint v2 — v3.34.0).
// Run with server up: AUTH_BASE=http://localhost:3456 node tests/elder-hint-telemetry.test.mjs
//
// Asserts spec v3.34.0 §B — schema validation, allowed enums, oversize body, rate limit.
// Mirrors seba-voice-telemetry.test.mjs / flow-event-telemetry.test.mjs pattern.

import assert from 'node:assert/strict';

const AUTH_BASE = process.env.AUTH_BASE || 'http://localhost:3456';
const URL = `${AUTH_BASE}/api/telemetry/elder-hint`;

let PASS = 0, FAIL = 0;
function ok(name, cond, detail){
  (cond ? console.log : console.error)(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  cond ? PASS++ : FAIL++;
}

function baseBody(over){
  return Object.assign({
    schema: 'v1',
    session_id: 'a1b2c3d4',
    story_id: 'thutmose-first-boundary-stone',
    chunk_id: 5,
    level: 3,
    virtue: 'Truth',
    register: 'reflection',
    hint_index: 1,
    hint_id: 'pool/elder/reflection.Truth.first/2',
    source: 'pool',
    action: 'shown',
    time_on_question_ms: 25000,
    ua_family: 'chrome',
    reduced_motion: false,
    ts: Date.now()
  }, over || {});
}

async function post(body){
  return fetch(URL, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
}

// Happy paths
ok('valid pool/shown payload → 204', (await post(baseBody())).status === 204);
ok('valid pool/tapped with time_shown_to_action_ms → 204',
   (await post(baseBody({ action:'tapped', time_shown_to_action_ms: 4500 }))).status === 204);
ok('valid pool/dismissed → 204', (await post(baseBody({ action:'dismissed' }))).status === 204);
ok('valid ai source → 204', (await post(baseBody({ source: 'ai', hint_id: 'ai/3f8a92c1' }))).status === 204);
ok('valid curated source → 204', (await post(baseBody({ source: 'curated', hint_id: 'curated/boundary-stone/reflection.Truth.first/0' }))).status === 204);
ok('valid comprehension register with virtue=null → 204', (await post(baseBody({ register: 'comprehension', virtue: null }))).status === 204);
ok('valid story_id null → 204', (await post(baseBody({ story_id: null }))).status === 204);
ok('valid chunk_id null → 204', (await post(baseBody({ chunk_id: null }))).status === 204);
ok('valid fallback_reason → 204', (await post(baseBody({ source: 'pool', fallback_reason: 'timeout' }))).status === 204);

// Schema field validation
ok('schema !== v1 → 400', (await post(baseBody({ schema: 'v2' }))).status === 400);
ok('missing session_id → 400', (await post(baseBody({ session_id: undefined }))).status === 400);
ok('invalid session_id format → 400', (await post(baseBody({ session_id: 'has spaces!' }))).status === 400);
ok('story_id with bad chars → 400', (await post(baseBody({ story_id: 'BAD STORY!' }))).status === 400);
ok('story_id too long → 400', (await post(baseBody({ story_id: 'x'.repeat(80) }))).status === 400);
ok('chunk_id < 0 → 400', (await post(baseBody({ chunk_id: -1 }))).status === 400);
ok('chunk_id > 200 → 400', (await post(baseBody({ chunk_id: 999 }))).status === 400);
ok('level < 1 → 400', (await post(baseBody({ level: 0 }))).status === 400);
ok('level > 6 → 400', (await post(baseBody({ level: 9 }))).status === 400);
ok('virtue too long → 400', (await post(baseBody({ virtue: 'x'.repeat(40) }))).status === 400);
ok('invalid register → 400', (await post(baseBody({ register: 'meditation' }))).status === 400);
ok('hint_index === 3 → 400', (await post(baseBody({ hint_index: 3 }))).status === 400);
ok('hint_index === 0 → 400', (await post(baseBody({ hint_index: 0 }))).status === 400);
ok('hint_id too long → 400', (await post(baseBody({ hint_id: 'x'.repeat(80) }))).status === 400);
ok('invalid source → 400', (await post(baseBody({ source: 'static' }))).status === 400);
ok('invalid fallback_reason → 400', (await post(baseBody({ source: 'pool', fallback_reason: 'unknown' }))).status === 400);
ok('invalid action → 400', (await post(baseBody({ action: 'clicked' }))).status === 400);
ok('time_on_question_ms < 0 → 400', (await post(baseBody({ time_on_question_ms: -100 }))).status === 400);
ok('non-bool reduced_motion → 400', (await post(baseBody({ reduced_motion: 'yes' }))).status === 400);
ok('ua_family too long → 400', (await post(baseBody({ ua_family: 'x'.repeat(40) }))).status === 400);

// Oversize body
const big = baseBody(); big.padding = 'x'.repeat(5000);
const r = await post(big);
ok('oversize body → 413/400', r.status === 413 || r.status === 400);

// Rate limit (60/min — fire 80 quickly, expect ≥1 429)
let any429 = false;
for (let i = 0; i < 80; i++){
  const rr = await post(baseBody());
  if (rr.status === 429){ any429 = true; break; }
}
ok('rate limit triggers within 80 reqs', any429);

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
