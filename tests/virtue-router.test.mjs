#!/usr/bin/env node
// Unit tests for lib/virtue-router.mjs (Slice 4 — adaptive virtue routing).
//
// Usage: node tests/virtue-router.test.mjs

import { selectDilemma, virtuesCoveredByPool, ALL_VIRTUES } from '../lib/virtue-router.mjs';

let PASS = 0, FAIL = 0;
function ok(name, cond, detail){
  (cond ? console.log : console.error)(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  cond ? PASS++ : FAIL++;
}

// A seeded deterministic RNG (mulberry32) so test outcomes are stable.
function seededRng(seed){
  let t = seed >>> 0;
  return function(){
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Fixed RNG that always returns a specific value — useful to force/prevent
// the 30% story-principle override branch.
const rngAlwaysLow  = () => 0.05;   // < 0.3 → triggers story-principle
const rngAlwaysHigh = () => 0.95;   // > 0.3 → never triggers story-principle

const L3_POOL = [
  { virtue:'Truth',       text:'T1' },
  { virtue:'Truth',       text:'T2' },
  { virtue:'Propriety',   text:'P1' },
  { virtue:'Balance',     text:'B1' },
  { virtue:'Balance',     text:'B2' },
  { virtue:'Reciprocity', text:'R1' },
];

function main(){
  // 1. Empty / invalid pool
  {
    const r = selectDilemma([], {}, 'Truth', 0, rngAlwaysHigh);
    ok('empty pool: dilemma null',       r.dilemma === null);
    ok('empty pool: strategy empty',     r.strategy === 'empty');
    ok('empty pool: targetVirtue null',  r.targetVirtue === null);
  }
  {
    const r = selectDilemma(null, {}, 'Truth', 0, rngAlwaysHigh);
    ok('null pool: strategy empty',      r.strategy === 'empty');
  }

  // 2. virtuesCoveredByPool gives uniq virtue list
  {
    const covered = virtuesCoveredByPool(L3_POOL);
    ok('covered: has Truth',       covered.includes('Truth'));
    ok('covered: has Propriety',   covered.includes('Propriety'));
    ok('covered: has Balance',     covered.includes('Balance'));
    ok('covered: has Reciprocity', covered.includes('Reciprocity'));
    ok('covered: no Justice',      !covered.includes('Justice'));
    ok('covered: uniq',            new Set(covered).size === covered.length);
  }

  // 3. Untested virtue selected first — fresh child, no virtue progress.
  //    High rng prevents story-principle override, so pure "untested" path.
  {
    const r = selectDilemma(L3_POOL, {}, null, 0, rngAlwaysHigh);
    ok('fresh child: strategy untested',     r.strategy === 'untested');
    ok('fresh child: virtue is covered',     ['Truth','Propriety','Balance','Reciprocity'].includes(r.targetVirtue));
    ok('fresh child: dilemma has virtue',    r.dilemma && r.dilemma.virtue === r.targetVirtue);
  }

  // 4. Partial progress — all tested except Reciprocity. Should pick Reciprocity.
  {
    const vp = { Truth: 3, Propriety: 2, Balance: 1, Justice: 5, Reciprocity: 0 };
    const r = selectDilemma(L3_POOL, vp, null, 0, rngAlwaysHigh);
    ok('partial: strategy untested',         r.strategy === 'untested');
    ok('partial: targets Reciprocity',       r.targetVirtue === 'Reciprocity');
    ok('partial: dilemma is Reciprocity',    r.dilemma.virtue === 'Reciprocity');
  }

  // 5. All tested — pick weakest.
  {
    const vp = { Truth: 4, Propriety: 7, Balance: 2, Reciprocity: 3 };
    const r = selectDilemma(L3_POOL, vp, null, 0, rngAlwaysHigh);
    ok('all tested: strategy weakest',       r.strategy === 'weakest');
    ok('all tested: targets Balance',        r.targetVirtue === 'Balance');
  }

  // 6. Weakest with ties — RNG breaks the tie, both options valid.
  {
    const vp = { Truth: 1, Propriety: 5, Balance: 1, Reciprocity: 1 };
    const r = selectDilemma(L3_POOL, vp, null, 0, seededRng(42));
    ok('weakest tie: strategy weakest',      r.strategy === 'weakest');
    ok('weakest tie: one of the weakest',    ['Truth','Balance','Reciprocity'].includes(r.targetVirtue));
  }

  // 7. Story-principle override — rng < 0.3 triggers, and pool covers principle.
  //    Child has fully tested all virtues, so absent override it'd pick weakest.
  {
    const vp = { Truth: 5, Propriety: 5, Balance: 5, Reciprocity: 5 };
    const r = selectDilemma(L3_POOL, vp, 'Reciprocity', 0, rngAlwaysLow);
    ok('override: strategy story_principle', r.strategy === 'story_principle');
    ok('override: targets Reciprocity',      r.targetVirtue === 'Reciprocity');
    ok('override: dilemma is Reciprocity',   r.dilemma.virtue === 'Reciprocity');
  }

  // 8. Story-principle NOT covered by pool — falls through to next strategy.
  {
    const vp = { Truth: 5, Propriety: 5, Balance: 5, Reciprocity: 5 };
    const r = selectDilemma(L3_POOL, vp, 'Justice', 0, rngAlwaysLow);
    ok('principle not in pool: falls through', r.strategy !== 'story_principle');
    ok('principle not in pool: still returns dilemma', r.dilemma !== null);
  }

  // 9. Story-principle rng > 0.3 — no override, falls through to untested/weakest.
  {
    const vp = { Truth: 5, Propriety: 5, Balance: 5 };  // Reciprocity = 0 → untested
    const r = selectDilemma(L3_POOL, vp, 'Truth', 0, rngAlwaysHigh);
    ok('rng high: no override',              r.strategy !== 'story_principle');
    ok('rng high: picks untested Reciprocity', r.targetVirtue === 'Reciprocity');
  }

  // 10. Rotation fallback — pool with no virtue tags at all.
  //     Covered set is empty → all branches skip → rotation.
  {
    const pool = [{ text:'A' }, { text:'B' }, { text:'C' }];
    const r0 = selectDilemma(pool, {}, null, 0, rngAlwaysHigh);
    const r1 = selectDilemma(pool, {}, null, 1, rngAlwaysHigh);
    const r2 = selectDilemma(pool, {}, null, 2, rngAlwaysHigh);
    const r3 = selectDilemma(pool, {}, null, 3, rngAlwaysHigh);
    ok('rotation: checkIdx 0 → A',          r0.dilemma.text === 'A');
    ok('rotation: checkIdx 1 → B',          r1.dilemma.text === 'B');
    ok('rotation: checkIdx 2 → C',          r2.dilemma.text === 'C');
    ok('rotation: wraps at length',         r3.dilemma.text === 'A');
    ok('rotation: strategy rotation',       r0.strategy === 'rotation');
    ok('rotation: targetVirtue null',       r0.targetVirtue === null);
  }

  // 11. Priority order — untested beats weakest even when rng would allow both.
  {
    const vp = { Truth: 1 };  // Truth=1, everything else=0 (untested)
    const r = selectDilemma(L3_POOL, vp, null, 0, rngAlwaysHigh);
    ok('priority: untested beats weakest',   r.strategy === 'untested');
    ok('priority: not Truth',                r.targetVirtue !== 'Truth');
  }

  // 12. Story-principle override beats untested — when rng is low and
  //     principle IS covered, even untested virtues lose priority.
  {
    const vp = { Truth: 5 };  // only Truth tested, Propriety/Balance/Reciprocity untested
    const r = selectDilemma(L3_POOL, vp, 'Truth', 0, rngAlwaysLow);
    ok('override beats untested',            r.strategy === 'story_principle');
    ok('override beats untested: Truth',     r.targetVirtue === 'Truth');
  }

  // 13. Whitespace-normalized virtue comparison — "Righteous Order" ↔ "RighteousOrder"
  {
    const pool = [{ virtue:'RighteousOrder', text:'X' }, { virtue:'Balance', text:'Y' }];
    const vp = { RighteousOrder: 10, Balance: 10 };
    const r = selectDilemma(pool, vp, 'Righteous Order', 0, rngAlwaysLow);
    ok('normalized: matches whitespace variant', r.strategy === 'story_principle');
    ok('normalized: targetVirtue canonical',     r.targetVirtue === 'RighteousOrder');
  }

  // 14. Always returns a dilemma object when pool non-empty.
  {
    const pool = [{ virtue:'Truth', text:'only-one' }];
    for(let i = 0; i < 20; i++){
      const r = selectDilemma(pool, { Truth: i }, 'Truth', i, seededRng(i+1));
      if(!r.dilemma){ ok(`never-null #${i}`, false); break; }
    }
    ok('never returns null dilemma (20 iters)', true);
  }

  // 15. ALL_VIRTUES export is stable.
  {
    ok('ALL_VIRTUES length=7', ALL_VIRTUES.length === 7);
    ok('ALL_VIRTUES includes Truth', ALL_VIRTUES.includes('Truth'));
    ok('ALL_VIRTUES includes RighteousOrder', ALL_VIRTUES.includes('RighteousOrder'));
  }

  // 16. Recent-text dedup — prefers fresh dilemmas for the target virtue.
  //     L3 Truth pool has 2 dilemmas. If one is in recent, the other is picked.
  {
    const recent = ['T1'];
    // Fresh child so all virtues untested; force Truth via principle override
    // so we isolate the dedup behavior for Truth's two dilemmas.
    for(let i = 0; i < 20; i++){
      const r = selectDilemma(L3_POOL, { Truth:5, Propriety:5, Balance:5, Reciprocity:5 }, 'Truth', 0, rngAlwaysLow, recent);
      ok(`dedup iter ${i}: picks fresh T2`, r.dilemma.text === 'T2');
      if(r.dilemma.text !== 'T2') break;
    }
  }

  // 17. Recent-text dedup — when ALL dilemmas for the virtue are recent,
  //     fall back to the full set (never return null).
  {
    const recent = ['T1','T2'];  // both Truth dilemmas recent
    const r = selectDilemma(L3_POOL, { Truth:5, Propriety:5, Balance:5, Reciprocity:5 }, 'Truth', 0, rngAlwaysLow, recent);
    ok('dedup exhausted: still returns a Truth dilemma', r.targetVirtue === 'Truth');
    ok('dedup exhausted: dilemma is Truth',              r.dilemma.virtue === 'Truth');
  }

  // 18. Recent list empty/undefined is handled.
  {
    const r1 = selectDilemma(L3_POOL, {}, null, 0, rngAlwaysHigh, []);
    const r2 = selectDilemma(L3_POOL, {}, null, 0, rngAlwaysHigh, undefined);
    ok('recent empty array: returns dilemma', r1.dilemma !== null);
    ok('recent undefined: returns dilemma',   r2.dilemma !== null);
  }

  // 19. v3.43.3 regression — single-dilemma-virtue + already-shown must NOT
  //     repeat. Fresh child (all virtues untested) + Reciprocity has only R1
  //     in pool + R1 in recent. Selection MUST return a different virtue's
  //     dilemma (any fresh), NOT a re-show of R1. This was the Amenirdis
  //     "judge the action" loop in production v3.43.0/.1/.2.
  {
    const recent = ['R1'];   // the only Reciprocity dilemma is in recent
    const allUntested = {};  // fresh child — every virtue is untested
    let sawR1Twice = false;
    let sawDifferent = false;
    for(let i = 0; i < 30; i++){
      // rngAlwaysHigh suppresses the 30% story-principle override branch
      const r = selectDilemma(L3_POOL, allUntested, 'Reciprocity', 0, rngAlwaysHigh, recent);
      if(r.dilemma && r.dilemma.text === 'R1') sawR1Twice = true;
      if(r.dilemma && r.dilemma.text !== 'R1') sawDifferent = true;
    }
    ok('v3.43.3 — single-dilemma-virtue exhausted: NEVER re-shows the recent dilemma', !sawR1Twice);
    ok('v3.43.3 — selection picks an alternative virtue when its own pool is exhausted', sawDifferent);
  }

  // 20. v3.43.3 regression — fully-exhausted pool falls through to rotation.
  {
    const allRecent = L3_POOL.map(d => d.text);
    const r = selectDilemma(L3_POOL, {}, null, 2, rngAlwaysHigh, allRecent);
    ok('v3.43.3 — fully-exhausted pool returns rotation strategy', r.strategy === 'rotation');
    ok('v3.43.3 — fully-exhausted pool still returns a dilemma',   r.dilemma !== null);
  }

  console.log(`\n${PASS} passed, ${FAIL} failed.`);
  process.exit(FAIL === 0 ? 0 : 1);
}

main();
