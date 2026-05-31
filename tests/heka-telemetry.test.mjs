#!/usr/bin/env node
// Integration test for POST /api/telemetry/heka (Heka Phase B).
//
// Asserts:
//   1. Valid v1 payload returns 204.
//   2. Missing / wrong schema version returns 400 bad_schema.
//   3. Malformed ids return 400 with the matching reason.
//   4. Bad enum values (fallback_used / completion) return 400.
//   5. Missing numeric fields return 400.
//   6. Nulls allowed where spec allows (first_interim_ms, first_confirm_ms).
//   7. Rate limit enforced (61 requests in one minute → 429).
//   8. Oversize body (>4kb) rejected by express.json limit (413 or 400).
//
// Usage:
//   AUTH_BASE=http://localhost:3456 node tests/heka-telemetry.test.mjs
//
// Server must be running. Rate-limit test requires a clean limiter bucket,
// so run this test in isolation (no other traffic from the same IP).

import assert from 'node:assert/strict';

const AUTH_BASE = process.env.AUTH_BASE || 'http://localhost:3456';
const URL = `${AUTH_BASE}/api/telemetry/heka`;

let PASS = 0, FAIL = 0;
function log(ok, name, detail) {
  (ok ? console.log : console.error)(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  ok ? PASS++ : FAIL++;
}
function ok(name, cond, detail){ log(!!cond, name, detail); }
function err(name, detail){ log(false, name, detail); }

function baseBody(overrides){
  return Object.assign({
    schema: 'v1',
    session_id: 'hs_test_' + Math.random().toString(36).slice(2, 10),
    story_id: 'twenty-fifth-dynasty-horses-of-piye',
    chunk_id: 3,
    level: 4,
    region: 'eastus',
    fallback_used: 'azure',
    word_count: 42,
    matched: 40,
    first_interim_ms: 180,
    first_confirm_ms: 420,
    completed_ms: 3200,
    completion: 'ok',
    ua_family: 'chrome',
    reduced_motion: false,
  }, overrides || {});
}

async function post(body){
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch(e){ /* 204 has no body */ }
  return { status: res.status, data };
}

async function main(){
  // 1. Happy path
  {
    const r = await post(baseBody());
    ok('valid payload → 204', r.status === 204, `got ${r.status}`);
  }

  // 2a. Missing schema
  {
    const b = baseBody(); delete b.schema;
    const r = await post(b);
    ok('missing schema → 400 bad_schema', r.status === 400 && r.data?.error === 'bad_schema',
       `status=${r.status} err=${r.data?.error}`);
  }

  // 2b. Wrong schema version
  {
    const r = await post(baseBody({ schema: 'v99' }));
    ok('wrong schema version → 400 bad_schema', r.status === 400 && r.data?.error === 'bad_schema');
  }

  // 3a. Bad session_id with spaces
  {
    const r = await post(baseBody({ session_id: 'not valid sid' }));
    ok('session_id w/ spaces → 400 bad_session_id', r.status === 400 && r.data?.error === 'bad_session_id');
  }

  // 3b. session_id not a string
  {
    const r = await post(baseBody({ session_id: 12345 }));
    ok('numeric session_id → 400 bad_session_id', r.status === 400 && r.data?.error === 'bad_session_id');
  }

  // 3c. Bad story_id
  {
    const r = await post(baseBody({ story_id: 'has spaces' }));
    ok('story_id w/ spaces → 400 bad_story_id', r.status === 400 && r.data?.error === 'bad_story_id');
  }

  // 4a. Unknown fallback_used
  {
    const r = await post(baseBody({ fallback_used: 'quantum' }));
    ok('unknown fallback_used → 400', r.status === 400 && r.data?.error === 'bad_fallback_used');
  }

  // 4b. Unknown completion
  {
    const r = await post(baseBody({ completion: 'partial' }));
    ok('unknown completion → 400', r.status === 400 && r.data?.error === 'bad_completion');
  }

  // 5. Missing completed_ms
  {
    const b = baseBody(); delete b.completed_ms;
    const r = await post(b);
    ok('missing completed_ms → 400', r.status === 400 && r.data?.error === 'bad_completed_ms');
  }

  // 6. first_interim_ms / first_confirm_ms null allowed
  {
    const r = await post(baseBody({ first_interim_ms: null, first_confirm_ms: null }));
    ok('null interim/confirm allowed → 204', r.status === 204, `got ${r.status}`);
  }

  // 6b. ua_family unknown falls back to 'other'
  {
    const r = await post(baseBody({ ua_family: 'lynx' }));
    ok('unknown ua_family accepted (coerced to other) → 204', r.status === 204);
  }

  // 7. Rate limit — 60/min/IP. Blast 70; expect ≥ 1 x 429 past the cap.
  // Isolated-only: skip if RUN_RATE=0 to avoid poisoning adjacent tests.
  if(process.env.RUN_RATE !== '0'){
    const results = [];
    for(let i = 0; i < 70; i++){
      // Sequential — fetch concurrency varies. Fine for 70.
      results.push(await post(baseBody({ session_id: 'hs_rate_' + i })));
    }
    const codes = results.map(r => r.status);
    const got429 = codes.some(c => c === 429);
    ok('rate limit fires after 60 → at least one 429', got429,
       `codes summary: ${Array.from(new Set(codes)).join(',')}`);
  } else {
    console.log('SKIP  rate-limit check (RUN_RATE=0)');
  }

  // 8. Oversize body (>4kb) rejected. express.json limit=4kb returns 413.
  {
    const big = baseBody({ region: 'x'.repeat(5000) });
    // region will be clipped by validator; real oversize lives at raw body level
    const raw = JSON.stringify(baseBody()) + ' '.repeat(5000);
    const r = await post(raw);
    ok('oversize body rejected (413/400)',
       r.status === 413 || r.status === 400,
       `got ${r.status}`);
  }

  console.log(`\n${PASS} passed, ${FAIL} failed.`);
  process.exit(FAIL === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL', e); process.exit(2); });
