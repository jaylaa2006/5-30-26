#!/usr/bin/env node
// tests/seba-voice-telemetry.test.mjs
// Integration test for POST /api/telemetry/seba-voice (Seba audio robustness — v3.33.0).
// Run with server up: AUTH_BASE=http://localhost:3456 node tests/seba-voice-telemetry.test.mjs
//
// Asserts schema validation, allowed pools/personas, oversize body, and rate limit.
// Mirrors flow-event-telemetry.test.mjs pattern.

import assert from 'node:assert/strict';

const AUTH_BASE = process.env.AUTH_BASE || 'http://localhost:3456';
const URL = `${AUTH_BASE}/api/telemetry/seba-voice`;

let PASS = 0, FAIL = 0;
function ok(name, cond, detail){
  (cond ? console.log : console.error)(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  cond ? PASS++ : FAIL++;
}

function baseBody(over){
  return Object.assign({
    tag: 'test',
    pool: 'young-mer',
    persona: 'young',
    fired: true,
    captionRendered: true,
    voiceMutedByUser: false,
    errorClass: null,
    ts: Date.now()
  }, over || {});
}

async function post(body){
  return fetch(URL, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
}

// Happy path
ok('valid payload → 204', (await post(baseBody())).status === 204);

// Schema validation — required fields
ok('missing tag → 400', (await post(baseBody({ tag: undefined }))).status === 400);
ok('empty tag → 400', (await post(baseBody({ tag: '' }))).status === 400);
ok('non-string tag → 400', (await post(baseBody({ tag: 123 }))).status === 400);
ok('tag > 64 chars → 400', (await post(baseBody({ tag: 'x'.repeat(80) }))).status === 400);

// Pool validation
ok('invalid pool → 400', (await post(baseBody({ pool: 'invalid-pool' }))).status === 400);
ok('missing pool → 400', (await post(baseBody({ pool: undefined }))).status === 400);

// Persona validation
ok('invalid persona → 400', (await post(baseBody({ persona: 'middle' }))).status === 400);
ok('missing persona → 400', (await post(baseBody({ persona: undefined }))).status === 400);

// Boolean fields
ok('non-bool fired → 400', (await post(baseBody({ fired: 'yes' }))).status === 400);
ok('non-bool captionRendered → 400', (await post(baseBody({ captionRendered: 1 }))).status === 400);
ok('non-bool voiceMutedByUser → 400', (await post(baseBody({ voiceMutedByUser: null }))).status === 400);

// errorClass
ok('errorClass non-null non-string → 400', (await post(baseBody({ errorClass: 42 }))).status === 400);
ok('null errorClass → 204', (await post(baseBody({ errorClass: null }))).status === 204);
ok('valid string errorClass → 204', (await post(baseBody({ errorClass: 'PlayRejected' }))).status === 204);
ok('errorClass > 80 chars → 400', (await post(baseBody({ errorClass: 'x'.repeat(120) }))).status === 400);

// Pool allowlist coverage — every defined pool returns 204
const VALID_POOLS = ['young-mer','young-sedjm','young-rekh','young-celebration','young-achievement','elder-sema','elder-sema-daily','elder-sema-redirect','elder-sema-approval'];
for (const p of VALID_POOLS){
  ok(`pool ${p} → 204`, (await post(baseBody({ pool: p }))).status === 204);
}

// Persona variants
ok('persona young → 204', (await post(baseBody({ persona: 'young' }))).status === 204);
ok('persona elder → 204', (await post(baseBody({ persona: 'elder' }))).status === 204);

// Oversize body
const big = baseBody(); big.padding = 'x'.repeat(5000);
const r = await post(big);
ok('oversize body → 413/400', r.status === 413 || r.status === 400);

// Rate limit (60/min — fire 80 quickly, expect at least one 429)
let any429 = false;
for (let i = 0; i < 80; i++){
  const rr = await post(baseBody());
  if (rr.status === 429){ any429 = true; break; }
}
ok('rate limit triggers within 80 reqs', any429);

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
