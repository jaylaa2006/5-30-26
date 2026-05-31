#!/usr/bin/env node
// Unit tests for lib/reader-stats.mjs (Phase C.2 aggregator).
//
// Mirrors tests/heka-stats.test.mjs; adds coverage for reader-specific
// extensions (accuracy ratio, circuit_open, listened_ms).
//
// Usage:
//   node tests/reader-stats.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  aggregateReaderStats, parseReaderEvents, percentile, summarizeEvents
} from '../lib/reader-stats.mjs';

let PASS = 0, FAIL = 0;
function ok(name, cond, detail){
  (cond ? console.log : console.error)(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  cond ? PASS++ : FAIL++;
}

function tel(over){
  return Object.assign({
    schema: 'v1',
    session_id: 'rs_' + Math.random().toString(36).slice(2, 10),
    story_id: 'test', chunk_id: 0, level: 4, region: 'eastus',
    fallback_used: 'azure', word_count: 100, matched: 90, missed: 10,
    first_interim_ms: 200, first_confirm_ms: 400,
    completed_ms: 15000, listened_ms: 14800,
    completion: 'ok', ua_family: 'chrome', reduced_motion: false,
    circuit_open: false,
  }, over || {});
}

function writeFixtureLog(events){
  const tmp = path.join(os.tmpdir(), `reader-stats-${Date.now()}-${Math.random().toString(36).slice(2,6)}.log`);
  const lines = events.map(e =>
    `0|perankh  | [READER-TEL] ${JSON.stringify(e)}`
  );
  lines.splice(1, 0, '0|perankh  | [CSP] {"docUri":"https://x"}');
  lines.splice(3, 0, '');
  lines.push('0|perankh  | unrelated output line');
  fs.writeFileSync(tmp, lines.join('\n'));
  return tmp;
}

function main(){
  // 1. percentile basics (same contract as heka-stats)
  ok('percentile empty → null', percentile([], 0.5) === null);
  ok('percentile single → that value', percentile([42], 0.5) === 42);
  {
    const arr = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    ok('percentile p50 of 10 sorted', percentile(arr, 0.50) === 60);
    ok('percentile p95 of 10 sorted', percentile(arr, 0.95) === 100);
  }

  // 2. parseReaderEvents skips noise + non-v1 + rejects HEKA lines
  {
    const lines = [
      '0|perankh  | [CSP] noise',
      '0|perankh  | [READER-TEL] {"schema":"v1","completion":"ok"}',
      '0|perankh  | [READER-TEL] {"schema":"v2","completion":"ok"}',
      '0|perankh  | [HEKA-TEL] {"schema":"v1","completion":"ok"}',
      '0|perankh  | [READER-TEL] not json at all',
      '',
      '0|perankh  | [READER-TEL] {"schema":"v1","completion":"timeout"}',
    ];
    const evs = parseReaderEvents(lines);
    ok('parseReaderEvents → 2 valid reader v1 events', evs.length === 2, `got ${evs.length}`);
    ok('first parsed completion=ok', evs[0].completion === 'ok');
    ok('ignores HEKA-TEL lines', !evs.some(e => e.completion === undefined && e.schema === 'v1' && Object.keys(e).length === 2));
  }

  // 3. summarizeEvents distributions + latencies + accuracy + circuit_open
  {
    const events = [
      tel({ completion: 'ok',        fallback_used: 'azure',     ua_family: 'chrome',  region: 'eastus',     first_interim_ms: 100, first_confirm_ms: 200, completed_ms: 10000, listened_ms: 9900,  matched: 50, missed: 5,  circuit_open: false }),
      tel({ completion: 'ok',        fallback_used: 'azure',     ua_family: 'firefox', region: 'eastus',     first_interim_ms: 200, first_confirm_ms: 350, completed_ms: 12000, listened_ms: 11900, matched: 60, missed: 10, circuit_open: false }),
      tel({ completion: 'timeout',   fallback_used: 'webspeech', ua_family: 'chrome',  region: 'westeurope', first_interim_ms: 300, first_confirm_ms: 500, completed_ms: 20000, listened_ms: 19500, matched: 70, missed: 30, circuit_open: true  }),
      tel({ completion: 'cancelled', fallback_used: 'typing',    ua_family: 'safari',  region: '',           first_interim_ms: null, first_confirm_ms: null, completed_ms: 5000, listened_ms: 4900, matched: 20, missed: 5, circuit_open: false }),
    ];
    const s = summarizeEvents(events);
    ok('total counted', s.total === 4);
    ok('completion ok=2', s.completion.ok === 2);
    ok('completion timeout=1', s.completion.timeout === 1);
    ok('completion cancelled=1', s.completion.cancelled === 1);
    ok('fallback azure=2', s.fallback.azure === 2);
    ok('fallback typing=1', s.fallback.typing === 1);
    ok('region eastus=2', s.region.eastus === 2);
    ok('region unknown=1 (empty region)', s.region.unknown === 1);
    ok('ua chrome=2', s.ua.chrome === 2);
    ok('latency first_interim n=3', s.latency.first_interim_ms.n === 3);
    ok('latency first_interim p50 sane', s.latency.first_interim_ms.p50 === 200);
    ok('latency listened n=4', s.latency.listened_ms.n === 4);
    ok('accuracy matched=200', s.accuracy.matched === 200);
    ok('accuracy missed=50', s.accuracy.missed === 50);
    ok('accuracy ratio=0.8', Math.abs(s.accuracy.ratio - 0.8) < 1e-9);
    ok('circuit_open count=1', s.circuit_open.count === 1);
    ok('circuit_open ratio=0.25', Math.abs(s.circuit_open.ratio - 0.25) < 1e-9);
  }

  // 4. summarizeEvents on empty
  {
    const s = summarizeEvents([]);
    ok('empty → total 0', s.total === 0);
    ok('empty → completion={}', Object.keys(s.completion).length === 0);
    ok('empty → latency={}', Object.keys(s.latency).length === 0);
    ok('empty → circuit_open.count=0', s.circuit_open.count === 0);
    ok('empty → circuit_open.ratio=null', s.circuit_open.ratio === null);
    ok('empty → accuracy.ratio=null', s.accuracy.ratio === null);
  }

  // 5. aggregateReaderStats over fixture file
  {
    const tmp = writeFixtureLog([
      tel({ completion: 'ok' }),
      tel({ completion: 'ok' }),
      tel({ completion: 'timeout', fallback_used: 'webspeech', circuit_open: true }),
    ]);
    try {
      const stats = aggregateReaderStats(tmp, 1000);
      ok('fixture aggregate total=3', stats.total === 3, `got ${stats.total}`);
      ok('fixture completion ok=2', stats.completion.ok === 2);
      ok('fixture fallback webspeech=1', stats.fallback.webspeech === 1);
      ok('fixture circuit_open count=1', stats.circuit_open.count === 1);
    } finally { fs.unlinkSync(tmp); }
  }

  // 6. aggregateReaderStats on missing file → graceful error
  {
    const stats = aggregateReaderStats('/tmp/__reader_no_such_file__', 1000);
    ok('missing file → error', stats.error === 'log_unavailable');
  }

  // 7. accuracy handles zero denom (no matched+missed numbers)
  {
    const events = [
      tel({ matched: 0, missed: 0 }),
      tel({ matched: 0, missed: 0 }),
    ];
    const s = summarizeEvents(events);
    ok('accuracy ratio=null when denom=0', s.accuracy.ratio === null);
  }

  console.log(`\n${PASS} passed, ${FAIL} failed.`);
  process.exit(FAIL === 0 ? 0 : 1);
}

main();
