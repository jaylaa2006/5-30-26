#!/usr/bin/env node
// Integration test for GET /api/admin/heka-stats (Phase C admin endpoint).
//
// Requires:
//   - seba-story-api running on port 3847
//   - ADMIN_API_KEY env var set on the server (matching ADMIN_KEY here)
//   - HEKA_LOG_PATH set on the server pointing at a writable fixture file
//
// Recommended runner script (one-shot):
//   FIX=/tmp/heka-fixture-$$.log; touch $FIX; \
//   ADMIN_API_KEY=test-admin-123 HEKA_LOG_PATH=$FIX node seba-story-api.mjs &
//   SERVER_PID=$!; sleep 2;
//   FIXTURE_PATH=$FIX ADMIN_KEY=test-admin-123 node tests/heka-admin.test.mjs;
//   kill $SERVER_PID; rm -f $FIX
//
// Asserts:
//   1. No admin key → 403
//   2. Wrong admin key → 403
//   3. Valid admin key, empty fixture → total:0
//   4. Valid admin key, fixture with events → aggregated stats

import assert from 'node:assert/strict';
import fs from 'node:fs';

const API_BASE   = process.env.API_BASE   || 'http://localhost:3847';
const ADMIN_KEY  = process.env.ADMIN_KEY  || 'test-admin-123';
const FIXTURE    = process.env.FIXTURE_PATH;
const URL        = `${API_BASE}/api/admin/heka-stats`;

let PASS = 0, FAIL = 0;
function ok(name, cond, detail){
  (cond ? console.log : console.error)(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  cond ? PASS++ : FAIL++;
}

if(!FIXTURE){
  console.error('FATAL  set FIXTURE_PATH to the same path as HEKA_LOG_PATH on the server.');
  process.exit(2);
}

function tel(over){
  return Object.assign({
    schema: 'v1',
    session_id: 'hs_test_' + Math.random().toString(36).slice(2, 10),
    story_id: 'test', chunk_id: 0, level: 4, region: 'eastus',
    fallback_used: 'azure', word_count: 20, matched: 18,
    first_interim_ms: 200, first_confirm_ms: 400,
    completed_ms: 2000, completion: 'ok', ua_family: 'chrome', reduced_motion: false,
  }, over || {});
}

async function get(headers){
  const res = await fetch(URL, { method: 'GET', headers: headers || {} });
  let data = null;
  try { data = await res.json(); } catch(e){}
  return { status: res.status, data };
}

async function main(){
  // 1. No admin key → 403
  {
    const r = await get({});
    ok('no admin key → 403', r.status === 403, `got ${r.status}`);
  }

  // 2. Wrong admin key → 403
  {
    const r = await get({ 'x-admin-key': 'wrong-key-xxxx' });
    ok('wrong admin key → 403', r.status === 403, `got ${r.status}`);
  }

  // 3. Empty fixture → total:0
  {
    fs.writeFileSync(FIXTURE, '');
    const r = await get({ 'x-admin-key': ADMIN_KEY });
    ok('empty fixture → 200', r.status === 200, `got ${r.status}`);
    ok('empty fixture → total:0', r.data?.total === 0, `total=${r.data?.total}`);
  }

  // 4. Fixture with events → aggregated stats
  {
    const events = [
      tel({ completion: 'ok',         fallback_used: 'azure',     ua_family: 'chrome', region: 'eastus' }),
      tel({ completion: 'ok',         fallback_used: 'azure',     ua_family: 'firefox', region: 'eastus' }),
      tel({ completion: 'timeout',    fallback_used: 'webspeech', ua_family: 'chrome', region: 'westeurope' }),
    ];
    const lines = events.map(e => `0|perankh  | [HEKA-TEL] ${JSON.stringify(e)}`);
    lines.unshift('0|perankh  | [CSP] noise');
    fs.writeFileSync(FIXTURE, lines.join('\n'));

    const r = await get({ 'x-admin-key': ADMIN_KEY });
    ok('events fixture → 200', r.status === 200);
    ok('events fixture → total:3', r.data?.total === 3, `total=${r.data?.total}`);
    ok('events completion ok=2', r.data?.completion?.ok === 2);
    ok('events fallback webspeech=1', r.data?.fallback?.webspeech === 1);
    ok('events region eastus=2', r.data?.region?.eastus === 2);
    ok('latency p50 returned', typeof r.data?.latency?.first_interim_ms?.p50 === 'number');
  }

  // 5. ?lines query clamped
  {
    const r = await get({ 'x-admin-key': ADMIN_KEY });
    const r2 = await fetch(URL + '?lines=99999', { headers: { 'x-admin-key': ADMIN_KEY } });
    ok('lines=99999 still 200 (clamped)', r2.status === 200);
  }

  console.log(`\n${PASS} passed, ${FAIL} failed.`);
  process.exit(FAIL === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL', e); process.exit(2); });
