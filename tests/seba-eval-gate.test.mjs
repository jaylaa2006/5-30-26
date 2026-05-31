#!/usr/bin/env node
// Unit tests for lib/seba-eval-gate.mjs (Slice 1 — rubric honesty fix).
//
// These assertions encode the "King failure mode": a warm, well-formed
// response that doesn't engage the question must NOT ride virtue detection
// to an inflated score. The server clamps on_topic='no' → max 3, regardless
// of what Gemini returned.
//
// Usage:
//   node tests/seba-eval-gate.test.mjs

import {
  applyTopicGate, capForOnTopic, normalizeOnTopic, tierForScore
} from '../lib/seba-eval-gate.mjs';

let PASS = 0, FAIL = 0;
function ok(name, cond, detail){
  (cond ? console.log : console.error)(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  cond ? PASS++ : FAIL++;
}

function main(){
  // 1. tierForScore
  ok('tier score=1 → Seed',    tierForScore(1)  === 'Seed');
  ok('tier score=2 → Seed',    tierForScore(2)  === 'Seed');
  ok('tier score=3 → Sprout',  tierForScore(3)  === 'Sprout');
  ok('tier score=5 → Sapling', tierForScore(5)  === 'Sapling');
  ok('tier score=7 → Tree',    tierForScore(7)  === 'Tree');
  ok('tier score=9 → Seba',    tierForScore(9)  === 'Seba');
  ok('tier score=10 → Seba',   tierForScore(10) === 'Seba');

  // 2. normalizeOnTopic
  ok('normalize yes',       normalizeOnTopic('yes')       === 'yes');
  ok('normalize partially', normalizeOnTopic('partially') === 'partially');
  ok('normalize no',        normalizeOnTopic('no')        === 'no');
  ok('normalize garbage→null',  normalizeOnTopic('maybe') === null);
  ok('normalize missing→null',  normalizeOnTopic(undefined) === null);
  ok('normalize empty→null',    normalizeOnTopic('') === null);

  // 3. capForOnTopic
  ok('cap no → 3',         capForOnTopic('no')        === 3);
  ok('cap partially → 5',  capForOnTopic('partially') === 5);
  ok('cap yes → 10',       capForOnTopic('yes')       === 10);
  ok('cap null → 10',      capForOnTopic(null)        === 10);
  ok('cap legacy off-topic sincerity → 3',
    capForOnTopic(null, 'off-topic') === 3);
  ok('cap on_topic=yes but sincerity=off-topic → 3 (paranoid)',
    capForOnTopic('yes', 'off-topic') === 3);

  // 4. The King case — warm, well-formed, but off-topic. Gemini says 6.
  //    Server must clamp to 3 AND re-derive tier.
  {
    const gemini = {
      on_topic: 'no',
      maatAlignment: 6,
      tierName: 'Sapling',
      virtuesPresent: ['Harmony','Truth'],
      sebaResponse: 'King, that is a lovely thought about your mom.',
      sincerity: 'genuine',
      register: 'mer',
    };
    const gated = applyTopicGate(gemini);
    ok('King case: score clamped 6 → 3',  gated.maatAlignment === 3);
    ok('King case: tier re-derived Sprout', gated.tierName === 'Sprout');
    ok('King case: on_topic preserved',     gated.on_topic === 'no');
    ok('King case: sincerity preserved',    gated.sincerity === 'genuine');
    ok('King case: virtues untouched',      Array.isArray(gated.virtuesPresent) && gated.virtuesPresent.length === 2);
    ok('King case: sebaResponse untouched', gated.sebaResponse.startsWith('King'));
    ok('King case: original mutated false', gemini.maatAlignment === 6);  // purity check
  }

  // 5. Partially on-topic — mentions subject but no reasoning. Cap at 5.
  {
    const gemini = {
      on_topic: 'partially',
      maatAlignment: 8,
      tierName: 'Tree',
      sincerity: 'genuine',
    };
    const gated = applyTopicGate(gemini);
    ok('partial: score clamped 8 → 5', gated.maatAlignment === 5);
    ok('partial: tier → Sapling',      gated.tierName === 'Sapling');
  }

  // 6. Fully on-topic — no clamp. Score passes through.
  {
    const gemini = {
      on_topic: 'yes',
      maatAlignment: 9,
      tierName: 'Seba',
      sincerity: 'genuine',
    };
    const gated = applyTopicGate(gemini);
    ok('on-topic: score preserved', gated.maatAlignment === 9);
    ok('on-topic: tier preserved',  gated.tierName === 'Seba');
  }

  // 7. Gemini omits on_topic — we do NOT assume 'yes'. But we also don't
  //    punish silence: cap falls through to 10 unless sincerity='off-topic'.
  {
    const gemini = { maatAlignment: 7, sincerity: 'genuine' };  // no on_topic
    const gated = applyTopicGate(gemini);
    ok('missing on_topic: score preserved',      gated.maatAlignment === 7);
    ok('missing on_topic: normalized to null',   gated.on_topic === null);
  }

  // 8. Legacy sincerity='off-topic' acts as hard cap even if Gemini skipped on_topic.
  {
    const gemini = { maatAlignment: 7, sincerity: 'off-topic' };
    const gated = applyTopicGate(gemini);
    ok('legacy off-topic sincerity: score clamped to 3',
      gated.maatAlignment === 3);
    ok('legacy off-topic sincerity: tier = Sprout',
      gated.tierName === 'Sprout');
  }

  // 9. Score outside [1,10] is clamped before capping.
  {
    const gated = applyTopicGate({ maatAlignment: 15, on_topic: 'yes', sincerity: 'genuine' });
    ok('score>10 clamped to 10', gated.maatAlignment === 10);
  }
  {
    const gated = applyTopicGate({ maatAlignment: 0, on_topic: 'no', sincerity: 'genuine' });
    ok('score<1 clamped to 1 then passes gate', gated.maatAlignment === 1);
  }
  {
    const gated = applyTopicGate({ maatAlignment: 'not a number', on_topic: 'yes', sincerity: 'genuine' });
    ok('non-number score → default 5', gated.maatAlignment === 5);
  }

  // 10. Null/undefined/non-object pass-through
  ok('null passes through',      applyTopicGate(null) === null);
  ok('undefined passes through', applyTopicGate(undefined) === undefined);
  ok('string passes through',    applyTopicGate('nope') === 'nope');

  // 11. Performative but on-topic — sincerity signal separate from gate.
  //     Score still passes (sincerity is advisory, not a gate).
  {
    const gated = applyTopicGate({
      on_topic: 'yes', sincerity: 'performative', maatAlignment: 7,
    });
    ok('performative on-topic: score preserved (sincerity is separate)',
      gated.maatAlignment === 7);
    ok('performative on-topic: sincerity preserved',
      gated.sincerity === 'performative');
  }

  console.log(`\n${PASS} passed, ${FAIL} failed.`);
  process.exit(FAIL === 0 ? 0 : 1);
}

main();
