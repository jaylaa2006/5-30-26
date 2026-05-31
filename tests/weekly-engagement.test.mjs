#!/usr/bin/env node
// Unit tests for lib/weekly-engagement.mjs (Slice 2 — honest weekly email).
//
// Usage: node tests/weekly-engagement.test.mjs

import { computeEngagementStats, buildHeadsUp } from '../lib/weekly-engagement.mjs';

let PASS = 0, FAIL = 0;
function ok(name, cond, detail){
  (cond ? console.log : console.error)(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  cond ? PASS++ : FAIL++;
}

function main(){
  // 1. Empty / null input
  {
    const s = computeEngagementStats([]);
    ok('empty list: total=0',                s.total === 0);
    ok('empty list: onTopicRatio=null',      s.onTopicRatio === null);
    ok('empty list: driftFlag=false',        s.driftFlag === false);
  }
  {
    const s = computeEngagementStats(null);
    ok('null input: total=0',                s.total === 0);
    ok('null input: driftFlag=false',        s.driftFlag === false);
  }

  // 2. All on-topic, all genuine — no drift
  {
    const s = computeEngagementStats([
      { on_topic: 'yes', sincerity: 'genuine' },
      { on_topic: 'yes', sincerity: 'genuine' },
      { on_topic: 'yes', sincerity: 'genuine' },
      { on_topic: 'yes', sincerity: 'genuine' },
    ]);
    ok('all on-topic: ratio=1',               s.onTopicRatio === 1);
    ok('all on-topic: driftFlag=false',       s.driftFlag === false);
    ok('all on-topic: no reasons',            s.driftReasons.length === 0);
    ok('all on-topic: headsUp null',          buildHeadsUp(s, 'King') === null);
  }

  // 3. King case — 4 of 5 off-topic, low ratio, genuine sincerity (the rubric
  //    was lying about virtue but sincerity looks fine in isolation). Must
  //    flag drift via off_topic reason.
  {
    const s = computeEngagementStats([
      { on_topic: 'no',  sincerity: 'genuine' },
      { on_topic: 'no',  sincerity: 'genuine' },
      { on_topic: 'no',  sincerity: 'genuine' },
      { on_topic: 'no',  sincerity: 'genuine' },
      { on_topic: 'yes', sincerity: 'genuine' },
    ]);
    ok('King case: ratio=0.2',                Math.abs(s.onTopicRatio - 0.2) < 1e-9);
    ok('King case: driftFlag=true',           s.driftFlag === true);
    ok('King case: reason=off_topic',         s.driftReasons.includes('off_topic'));
    ok('King case: reason NOT performative',  !s.driftReasons.includes('performative'));
    const h = buildHeadsUp(s, 'King');
    ok('King case: headsUp not null',         h !== null);
    ok('King case: headsUp has title',        h.title === 'Heads up');
    ok('King case: headsUp names child',      h.lines[0].includes('King'));
    ok('King case: headsUp mentions 20%',     h.lines[0].includes('20%'));
  }

  // 4. Performative pattern — all on-topic but going through the motions.
  {
    const s = computeEngagementStats([
      { on_topic: 'yes', sincerity: 'performative' },
      { on_topic: 'yes', sincerity: 'performative' },
      { on_topic: 'yes', sincerity: 'performative' },
      { on_topic: 'yes', sincerity: 'genuine' },
    ]);
    ok('performative: ratio=1',               s.onTopicRatio === 1);
    ok('performative: driftFlag=true',        s.driftFlag === true);
    ok('performative: reason=performative',   s.driftReasons.includes('performative'));
    ok('performative: NOT off_topic',         !s.driftReasons.includes('off_topic'));
    const h = buildHeadsUp(s, 'Seba');
    ok('performative: headsUp not null',      h !== null);
    ok('performative: headsUp mentions count',h.lines[0].includes('3 responses'));
  }

  // 5. Both triggers fire — two headsUp lines.
  {
    const s = computeEngagementStats([
      { on_topic: 'no',  sincerity: 'performative' },
      { on_topic: 'no',  sincerity: 'performative' },
      { on_topic: 'no',  sincerity: 'performative' },
      { on_topic: 'no',  sincerity: 'performative' },
    ]);
    ok('both triggers: driftFlag=true',       s.driftFlag === true);
    ok('both triggers: reasons length=2',     s.driftReasons.length === 2);
    const h = buildHeadsUp(s, 'Child');
    ok('both triggers: headsUp has 2 lines',  h.lines.length === 2);
  }

  // 6. Small sample (<3) — even 100% off-topic doesn't trigger ratio rule.
  //    Rationale: one bad day ≠ a pattern, don't alarm the parent.
  {
    const s = computeEngagementStats([
      { on_topic: 'no', sincerity: 'genuine' },
      { on_topic: 'no', sincerity: 'genuine' },
    ]);
    ok('small sample: ratio=0',               s.onTopicRatio === 0);
    ok('small sample: no ratio drift',        !s.driftReasons.includes('off_topic'));
    ok('small sample: driftFlag=false',       s.driftFlag === false);
  }

  // 7. Performative fires on content even when the ratio rule does not.
  //    Sample has only 2 with on_topic tags (under the 3-required), but 3
  //    performative hits — drift fires via performative reason only.
  {
    const s = computeEngagementStats([
      { on_topic: 'yes', sincerity: 'performative' },
      { on_topic: 'yes', sincerity: 'performative' },
      {                  sincerity: 'performative' },  // legacy, no on_topic tag
    ]);
    ok('performative-only: drift=true',       s.driftFlag === true);
    ok('performative-only: only performative reason',
       s.driftReasons.length === 1 && s.driftReasons[0] === 'performative');
  }

  // 8. Responses missing on_topic are excluded from ratio but still counted in total.
  {
    const s = computeEngagementStats([
      { sincerity: 'genuine' },                        // legacy, no on_topic
      { sincerity: 'genuine' },
      { on_topic: 'yes', sincerity: 'genuine' },
    ]);
    ok('legacy: total=3',                     s.total === 3);
    ok('legacy: totalWithOnTopic=1',          s.totalWithOnTopic === 1);
    ok('legacy: onTopicRatio=1',              s.onTopicRatio === 1);
    ok('legacy: no drift',                    s.driftFlag === false);
  }

  // 9. Partial on-topic counts as "not yes" for ratio, but shown separately.
  {
    const s = computeEngagementStats([
      { on_topic: 'partially', sincerity: 'genuine' },
      { on_topic: 'partially', sincerity: 'genuine' },
      { on_topic: 'partially', sincerity: 'genuine' },
      { on_topic: 'no',        sincerity: 'genuine' },
    ]);
    ok('partial-heavy: ratio=0',              s.onTopicRatio === 0);
    ok('partial-heavy: partiallyCount=3',     s.partiallyCount === 3);
    ok('partial-heavy: driftFlag=true',       s.driftFlag === true);
  }

  // 10. Exactly at threshold — 60% is NOT drift (must be strictly less).
  {
    const s = computeEngagementStats([
      { on_topic: 'yes', sincerity: 'genuine' },
      { on_topic: 'yes', sincerity: 'genuine' },
      { on_topic: 'yes', sincerity: 'genuine' },
      { on_topic: 'no',  sincerity: 'genuine' },
      { on_topic: 'no',  sincerity: 'genuine' },
    ]);
    ok('at-threshold 60%: no drift',          s.driftFlag === false);
  }

  console.log(`\n${PASS} passed, ${FAIL} failed.`);
  process.exit(FAIL === 0 ? 0 : 1);
}

main();
