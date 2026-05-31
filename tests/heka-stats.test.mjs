#!/usr/bin/env node
// Unit tests for lib/heka-stats.mjs (Phase C aggregator).
//
// No live server required — operates on a temp fixture log file.
//
// Usage:
//   node tests/heka-stats.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  aggregateHekaStats, parseHekaEvents, percentile, summarizeEvents
} from '../lib/heka-stats.mjs';

let PASS = 0, FAIL = 0;
function ok(name, cond, detail){
  (cond ? console.log : console.error)(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  cond ? PASS++ : FAIL++;
}

function tel(over){
  return Object.assign({
    schema: 'v1',
    session_id: 'hs_' + Math.random().toString(36).slice(2, 10),
    story_id: 'test', chunk_id: 0, level: 4, region: 'eastus',
    fallback_used: 'azure', word_count: 20, matched: 18,
    first_interim_ms: 200, first_confirm_ms: 400,
    completed_ms: 2000, completion: 'ok', ua_family: 'chrome', reduced_motion: false,
  }, over || {});
}

function writeFixtureLog(events){
  const tmp = path.join(os.tmpdir(), `heka-stats-${Date.now()}-${Math.random().toString(36).slice(2,6)}.log`);
  const lines = events.map(e =>
    `0|perankh  | [HEKA-TEL] ${JSON.stringify(e)}`
  );
  // Mix in some unrelated noise lines to test parser robustness
  lines.splice(1, 0, '0|perankh  | [CSP] {"docUri":"https://x"}');
  lines.splice(3, 0, '');
  lines.push('0|perankh  | random output line nothing relevant');
  fs.writeFileSync(tmp, lines.join('\n'));
  return tmp;
}

function main(){
  // 1. percentile basics
  ok('percentile empty → null', percentile([], 0.5) === null);
  ok('percentile single → that value', percentile([42], 0.5) === 42);
  {
    const arr = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    ok('percentile p50 of 10 sorted', percentile(arr, 0.50) === 60);
    ok('percentile p95 of 10 sorted', percentile(arr, 0.95) === 100);
  }

  // 2. parseHekaEvents skips noise + non-v1
  {
    const lines = [
      '0|perankh  | [CSP] noise',
      '0|perankh  | [HEKA-TEL] {"schema":"v1","completion":"ok"}',
      '0|perankh  | [HEKA-TEL] {"schema":"v2","completion":"ok"}',  // wrong schema
      '0|perankh  | [HEKA-TEL] not json at all',
      '',
      '0|perankh  | [HEKA-TEL] {"schema":"v1","completion":"timeout"}',
    ];
    const evs = parseHekaEvents(lines);
    ok('parseHekaEvents → 2 valid v1 events', evs.length === 2, `got ${evs.length}`);
    ok('first parsed completion=ok', evs[0].completion === 'ok');
  }

  // 3. summarizeEvents distributions + latencies
  {
    const events = [
      tel({ completion: 'ok',         fallback_used: 'azure',     ua_family: 'chrome',  region: 'eastus',     first_interim_ms: 100, first_confirm_ms: 200 }),
      tel({ completion: 'ok',         fallback_used: 'azure',     ua_family: 'firefox', region: 'eastus',     first_interim_ms: 200, first_confirm_ms: 350 }),
      tel({ completion: 'timeout',    fallback_used: 'webspeech', ua_family: 'chrome',  region: 'westeurope', first_interim_ms: 300, first_confirm_ms: 500 }),
      tel({ completion: 'cancelled',  fallback_used: 'typing',    ua_family: 'safari',  region: '',           first_interim_ms: null, first_confirm_ms: null }),
    ];
    const s = summarizeEvents(events);
    ok('total counted', s.total === 4);
    ok('completion ok=2', s.completion.ok === 2);
    ok('completion timeout=1', s.completion.timeout === 1);
    ok('fallback azure=2', s.fallback.azure === 2);
    ok('fallback typing=1', s.fallback.typing === 1);
    ok('region eastus=2', s.region.eastus === 2);
    ok('region unknown=1 (empty region)', s.region.unknown === 1);
    ok('ua chrome=2', s.ua.chrome === 2);
    ok('latency first_interim n=3', s.latency.first_interim_ms.n === 3);
    ok('latency first_interim p50 sane', s.latency.first_interim_ms.p50 === 200);
  }

  // 4. summarizeEvents on empty
  {
    const s = summarizeEvents([]);
    ok('empty → total 0', s.total === 0);
    ok('empty → completion={}', Object.keys(s.completion).length === 0);
    ok('empty → latency={}', Object.keys(s.latency).length === 0);
  }

  // 5. aggregateHekaStats over fixture file
  {
    const tmp = writeFixtureLog([
      tel({ completion: 'ok' }),
      tel({ completion: 'ok' }),
      tel({ completion: 'timeout', fallback_used: 'webspeech' }),
    ]);
    try {
      const stats = aggregateHekaStats(tmp, 1000);
      ok('fixture aggregate total=3', stats.total === 3, `got ${stats.total}`);
      ok('fixture completion ok=2', stats.completion.ok === 2);
      ok('fixture fallback webspeech=1', stats.fallback.webspeech === 1);
    } finally { fs.unlinkSync(tmp); }
  }

  // 6. aggregateHekaStats on missing file → graceful error
  {
    const stats = aggregateHekaStats('/tmp/__heka_no_such_file__', 1000);
    ok('missing file → error', stats.error === 'log_unavailable');
  }

  console.log(`\n${PASS} passed, ${FAIL} failed.`);
  process.exit(FAIL === 0 ? 0 : 1);
}

main();
