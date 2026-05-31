#!/usr/bin/env node
// Integration test for POST /api/telemetry/flow-event.
// Run with server up: AUTH_BASE=http://localhost:3456 node tests/flow-event-telemetry.test.mjs
//
// Asserts schema v1 validation, allowed event names, optional fields,
// rate limit, and oversize body behaviour. Mirrors the senebty-glossary
// telemetry test pattern.

import assert from 'node:assert/strict';

const AUTH_BASE = process.env.AUTH_BASE || 'http://localhost:3456';
const URL = `${AUTH_BASE}/api/telemetry/flow-event`;

let PASS = 0, FAIL = 0;
function ok(name, cond, detail){ (cond ? console.log : console.error)(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); cond ? PASS++ : FAIL++; }

function baseBody(over){
  return Object.assign({
    schema: 'v1',
    session_id: 'hs_test_' + Math.random().toString(36).slice(2, 10),
    event: 'comprehension-pool-fallback',
    story_id: 'ahmose-desert-scout',
    level: 4,
    meta: { assembled_count: 12 },
    ua_family: 'chrome',
    reduced_motion: false
  }, over || {});
}
async function post(body){
  return fetch(URL, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
}

// Happy path
const r1 = await post(baseBody()); ok('valid v1 → 204', r1.status === 204);

// empty-questions-after-fallback variant
const r2 = await post(baseBody({ event: 'empty-questions-after-fallback' }));
ok('empty-questions-after-fallback event → 204', r2.status === 204);

// Schema validation
const r3 = await post(baseBody({ schema: 'v2' }));                            ok('bad schema → 400', r3.status === 400);
const r4 = await post(baseBody({ session_id: 'has spaces!' }));               ok('bad session_id → 400', r4.status === 400);
const r5 = await post(baseBody({ event: 'unknown-event-name' }));             ok('unknown event name → 400', r5.status === 400);
const r6 = await post(baseBody({ story_id: 'BAD STORY ID!' }));               ok('bad story_id → 400', r6.status === 400);
const r7 = await post(baseBody({ story_id: null }));                          ok('null story_id → 204', r7.status === 204);
const r8 = await post(baseBody({ level: -1 }));                               ok('negative level → 400', r8.status === 400);
const r9 = await post(baseBody({ level: 99 }));                               ok('level > 6 → 400', r9.status === 400);
const r10 = await post(baseBody({ reduced_motion: 'yes' }));                   ok('non-bool reduced_motion → 400', r10.status === 400);
const r11 = await post(baseBody({ ua_family: 'netscape' }));                   ok('unknown ua_family coerced → 204', r11.status === 204);

// Meta validation
const r12 = await post(baseBody({ meta: { count: 5, name: 'ok', flag: true, missing: null } }));
ok('meta with primitive values → 204', r12.status === 204);
const r13 = await post(baseBody({ meta: { nested: { deep: 1 } } }));
ok('meta with nested object → 400', r13.status === 400);
const r14 = await post(baseBody({ meta: ['array'] }));
ok('meta as array → 400', r14.status === 400);
const r15 = await post(baseBody({ meta: null }));
ok('null meta → 204', r15.status === 204);

// Oversize body
const big = baseBody(); big.padding = 'x'.repeat(5000);
const r16 = await post(big);
ok('oversize body → 413/400', r16.status === 413 || r16.status === 400);

// Rate limit (30/min — fire 40 quickly, expect at least one 429)
let any429 = false;
for (let i = 0; i < 40; i++){
  const r = await post(baseBody());
  if (r.status === 429){ any429 = true; break; }
}
ok('rate limit triggers within 40 reqs', any429);

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
