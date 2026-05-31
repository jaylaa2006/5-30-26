#!/usr/bin/env node
// tests/elder-hint-endpoint.test.mjs
// Integration test for POST /api/seba-elder-hint (Elder Hint v2 — v3.34.0).
// Run with seba-story-api up: AUTH_BASE=http://localhost:3847 node tests/elder-hint-endpoint.test.mjs
//
// In production the same path is proxied via nginx through to localhost:3847; in dev,
// AUTH_BASE should point to wherever seba-story-api.mjs is running (typically
// http://localhost:3847 for direct dev). For the rare case where an nginx-fronted
// dev box runs server.js on 3456 with proxy_pass, AUTH_BASE=http://localhost:3456
// also works.
//
// Asserts spec v3.34.0 §A — response shape, citation field, cache key, requestId echo.
// Mirrors flow-event-telemetry.test.mjs / seba-voice-telemetry.test.mjs pattern.

import assert from 'node:assert/strict';

const AUTH_BASE = process.env.AUTH_BASE || 'http://localhost:3847';
const URL = `${AUTH_BASE}/api/seba-elder-hint`;

let PASS = 0, FAIL = 0;
function ok(name, cond, detail){
  (cond ? console.log : console.error)(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  cond ? PASS++ : FAIL++;
}

async function post(body){
  return fetch(URL, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
}

function baseBody(over){
  return Object.assign({
    checkpointType: 'comprehension',
    question: 'What did the boundary stone protect?',
    childLevel: 3,
    hintNumber: 0,
    storyTitle: 'thutmose-first-boundary-stone',
    childName: 'Test Child'
  }, over || {});
}

// Happy path — endpoint responds 200 (regardless of AI vs fallback)
{
  const r = await post(baseBody());
  ok('valid request returns 200', r.status === 200);
  if (r.status === 200){
    const data = await r.json();
    ok('response includes elderName=Seba Ptahhotep', data.elderName === 'Seba Ptahhotep');
    ok('response includes requestId (16-char hex)', typeof data.requestId === 'string' && /^[a-f0-9]{16}$/.test(data.requestId));
    ok('response includes source field', typeof data.source === 'string' && ['ai', 'pool'].includes(data.source));

    if (data.fallback === true){
      // fallback path
      ok('fallback response has fallbackReason', typeof data.fallbackReason === 'string');
      ok('fallback fallbackReason is valid enum',
         ['budget','rate','gemini-error','invalid-output','max-tokens'].includes(data.fallbackReason));
      ok('fallback response has hint:null', data.hint === null);
    } else {
      // ai-success path
      ok('success response has hint string', typeof data.hint === 'string' && data.hint.length >= 6 && data.hint.length <= 600);
      ok('success response has citation when ELDER_HINT_REQUIRE_CITATION=true (or null)',
         data.citation === null || data.citation === undefined ||
         (data.citation && Number.isInteger(data.citation.maximId) && data.citation.maximId >= 1 && data.citation.maximId <= 37));
      if (data.citation){
        ok('citation.maximSource is correct', data.citation.maximSource === 'Maxims of Ptahhotep');
        ok('citation.confidence is high or low',
           data.citation.confidence === 'high' || data.citation.confidence === 'low');
        ok('citation.attribution is non-empty string',
           typeof data.citation.attribution === 'string' && data.citation.attribution.length > 0);
      }
    }
  }
}

// Validation
{
  const r = await post(baseBody({ checkpointType: undefined }));
  ok('missing checkpointType → 400', r.status === 400);
}

// Cache-key correctness — different childLevel must produce different cached entries
{
  // L1 baseline
  const r1 = await post(baseBody({ childLevel: 1, question: 'cache-key-test-' + Date.now() }));
  ok('L1 first call returns 200', r1.status === 200);

  // Same question + level — should hit cache (or at least return same hint shape)
  const sameQuestion = 'cache-key-stable-' + Date.now();
  const r2a = await post(baseBody({ childLevel: 1, question: sameQuestion }));
  const r2b = await post(baseBody({ childLevel: 1, question: sameQuestion }));
  ok('repeat L1 same question returns 200', r2a.status === 200 && r2b.status === 200);

  // Capture L1 body for cross-comparison BEFORE consuming r2a in cache-equality assertion
  let dL1 = null;
  if (r2a.status === 200 && r2b.status === 200){
    const da = await r2a.clone().json();
    const db = await r2b.json();
    dL1 = da;
    // If both succeeded with hints, second should match first (cache hit). If either fell back, still OK.
    if (da.hint && db.hint){
      ok('cache hit returns same hint for same level + question', da.hint === db.hint);
    }
  }

  // L6 same question — MUST cache-miss vs L1
  const r3 = await post(baseBody({ childLevel: 6, question: sameQuestion }));
  ok('L6 same question returns 200', r3.status === 200);
  if (r3.status === 200 && dL1){
    const dL6 = await r3.json();
    // Either hint differs, OR both happen to fall back. Either is a valid pass — the bug
    // would be returning the same cached hint string for L1 and L6.
    if (dL1.hint && dL6.hint){
      // We can't 100% guarantee Gemini returns different hints; but the cache key must
      // route them through different cache buckets. A weaker assertion: both responses
      // have requestIds, and they are NOT identical (cache-key correctness implies different
      // cache slots, which implies different requestIds because each cache slot was populated
      // by an independent call).
      ok('L1 vs L6 cache slots differ (requestIds differ)', dL1.requestId !== dL6.requestId);
    }
  }
}

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
