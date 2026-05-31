#!/usr/bin/env node
// tests/senebty-glossary-telemetry.test.mjs
// Integration test for POST /api/telemetry/senebty-glossary.
// Run with server up: AUTH_BASE=http://localhost:3456 node tests/senebty-glossary-telemetry.test.mjs

import assert from 'node:assert/strict';

const AUTH_BASE = process.env.AUTH_BASE || 'http://localhost:3456';
const URL = `${AUTH_BASE}/api/telemetry/senebty-glossary`;

let PASS = 0, FAIL = 0;
function ok(name, cond, detail){ (cond ? console.log : console.error)(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); cond ? PASS++ : FAIL++; }

function baseBody(over){
  return Object.assign({
    schema: 'v1',
    session_id: 'hs_test_' + Math.random().toString(36).slice(2, 10),
    term: 'mu',
    source: 'search',
    level: 1,
    ua_family: 'chrome',
    reduced_motion: false
  }, over || {});
}
async function post(body){
  return fetch(URL, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
}

const r1  = await post(baseBody());                                           ok('valid v1 → 204', r1.status === 204);
const r2  = await post(baseBody({ schema: 'v2' }));                            ok('bad schema → 400', r2.status === 400);
const r3  = await post(baseBody({ session_id: 'has spaces!' }));               ok('bad session_id → 400', r3.status === 400);
const r4  = await post(baseBody({ term: '' }));                                ok('empty term → 400', r4.status === 400);
const r5  = await post(baseBody({ term: 'x'.repeat(64) }));                    ok('term >32 chars → 400', r5.status === 400);
const r6  = await post(baseBody({ source: 'evil-source' }));                   ok('unknown source → 400', r6.status === 400);
const r7  = await post(baseBody({ level: -1 }));                               ok('negative level → 400', r7.status === 400);
const r8  = await post(baseBody({ level: 99 }));                               ok('level >6 → 400', r8.status === 400);
const r9  = await post(baseBody({ ua_family: 'netscape' }));                   ok('unknown ua_family coerced → 204', r9.status === 204);
const r10 = await post(baseBody({ reduced_motion: 'yes' }));                   ok('non-bool reduced_motion → 400', r10.status === 400);

// oversize body — must run BEFORE the rate-limit storm so the 413 isn't masked by 429
const big = baseBody(); big.padding = 'x'.repeat(5000);
const r11 = await post(big);
ok('oversize body → 413/400', r11.status === 413 || r11.status === 400);

// rate limit (60/min) — fire up to 70 requests until one returns 429
let any429 = false;
for (let i = 0; i < 70; i++){
  const r = await post(baseBody());
  if (r.status === 429){ any429 = true; break; }
}
ok('rate limit triggers within 70 reqs', any429);

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
