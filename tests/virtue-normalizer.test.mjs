#!/usr/bin/env node
// Tests for principleToVirtue() in lib/virtue-router.mjs (Slice 4 / Path Z).
//
// Every unique `story.principle` value currently in maat-reader.html must
// normalize to one of the 7 canonical Maat virtues. Zero nulls allowed —
// an unmappable principle would orphan that story's virtueProgress.
//
// Usage: node tests/virtue-normalizer.test.mjs

import { principleToVirtue, ALL_VIRTUES } from '../lib/virtue-router.mjs';

let PASS = 0, FAIL = 0;
function ok(name, cond, detail){
  (cond ? console.log : console.error)(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  cond ? PASS++ : FAIL++;
}

// Every unique principle label currently in maat-reader.html (n=115 as of v3.24.0).
// Listed with the expected canonical virtue. Order reflects lexical sort from
// `grep -oE "principle:'[^']+'" maat-reader.html | sort -u`.
const EXPECTED = [
  ['Accountability & Restraint',                                 'Justice'],
  ['Accountability',                                             'Justice'],
  ['All Principles of Maat',                                     'RighteousOrder'],
  ['Ancestral Wisdom & Oral Tradition',                          'Reciprocity'],
  ['Balance & Wisdom',                                           'Balance'],
  ['Balance',                                                    'Balance'],
  ['Care & Responsibility',                                      'Reciprocity'],
  ['Commitment to Maat, Integrity, Perseverance',                'RighteousOrder'],
  ['Community & Justice',                                        'Harmony'],
  ['Compassion vs Justice',                                      'Justice'],
  ['Compassion',                                                 'Justice'],
  ['Consequence & Foresight',                                    'RighteousOrder'],
  ['Cosmic Balance',                                             'Balance'],
  ['Courage & Consequence',                                      'RighteousOrder'],
  ['Courage & Discipline',                                       'RighteousOrder'],
  ['Courage & Sacrifice',                                        'RighteousOrder'],
  ['Courage',                                                    'RighteousOrder'],
  ['Daily Maat',                                                 'Reciprocity'],
  ['Discernment & Sovereignty',                                  'RighteousOrder'],
  ['Discipline & Focus',                                         'Propriety'],
  ['Discipline',                                                 'Propriety'],
  ['Duty & Righteousness',                                       'RighteousOrder'],
  ['Duty vs Promise',                                            'RighteousOrder'],
  ['Environmental Maat',                                         'Reciprocity'],
  ['Fair Exchange & Balance',                                    'Balance'],
  ['Fair Trade & Justice',                                       'Balance'],
  ['Fairness & Balance',                                         'Justice'],
  ['Family & Duty',                                              'Reciprocity'],
  ['Generosity & Responsibility',                                'Reciprocity'],
  ['Harmony & Return',                                           'Harmony'],
  ['Harmony — the necessity of difference within unity',         'Harmony'],
  ['Harmony',                                                    'Harmony'],
  ['Healing & the Return-to-Ka',                                 'Balance'],
  ['Heka & Maat in Action',                                      'RighteousOrder'],
  ['Honesty & Courage',                                          'Truth'],
  ['Honor vs Life',                                              'Truth'],
  ['Hospitality & Generosity',                                   'Reciprocity'],
  ['Imperial Violence vs Maat\u2019s Verdict',                   'Justice'],
  ['Innovation & Integrity',                                     'Propriety'],
  ['Integrity & Courage',                                        'Truth'],
  ['Integrity & Knowledge',                                      'Truth'],
  ['Justice & Balance',                                          'Justice'],
  ['Justice & Compassion',                                       'Justice'],
  ['Justice & Impartiality',                                     'Justice'],
  ['Justice & Loyalty',                                          'Justice'],
  ['Justice & Reciprocity',                                      'Justice'],
  ['Justice & Sovereignty',                                      'Justice'],
  ['Justice Before Law & The Manden Charter of 1235',            'Justice'],
  ['Justice Before Law',                                         'Justice'],
  ['Justice — power and accountability',                         'Justice'],
  ['Justice',                                                    'Justice'],
  ['Knowledge & Innovation',                                     'Propriety'],
  ['Knowledge & Memory',                                         'Propriety'],
  ['Knowledge, Power & Who Controls Truth',                      'Propriety'],
  ['Law & Compassion',                                           'Justice'],
  ['Leadership & Holistic Maat',                                 'RighteousOrder'],
  ['Learning & Order',                                           'Propriety'],
  ['Legacy & Purpose',                                           'RighteousOrder'],
  ['Legacy vs Justice',                                          'RighteousOrder'],
  ['Love & Generosity',                                          'Reciprocity'],
  ['Loyalty, Shadow & Yehudah\u2019s Choice',                    'RighteousOrder'],
  ['Maat & Isfet in Action',                                     'Justice'],
  ['Maat: Balance, Order, and the Responsibility of Leadership', 'Balance'],
  ['Maat: Collective Responsibility and the Preservation of Ka', 'Harmony'],
  ['Maat: Compassion for All People',                            'Justice'],
  ['Maat: Connection and Community',                             'Harmony'],
  ['Maat: Cosmic Order Written in the Stars',                    'Balance'],
  ['Maat: Fair Exchange and Balance',                            'Balance'],
  ['Maat: Knowledge Must Travel Freely',                         'Propriety'],
  ['Maat: Power and Responsibility',                             'RighteousOrder'],
  ['Maat: Preservation of Truth',                                'Truth'],
  ['Maat: Truth Cannot Be Erased',                               'Truth'],
  ['Maat: Truth, Justice, and Righteousness vs. Isfet: Disorder and Injustice', 'Truth'],
  ['Maat: Truth, Justice, and the Duty to Uphold Righteousness', 'Truth'],
  ['Order vs Justice',                                           'RighteousOrder'],
  ['Patience & Balance',                                         'Propriety'],
  ['Patience & Craftsmanship',                                   'Propriety'],
  ['Perseverance & Destiny',                                     'RighteousOrder'],
  ['Power & Purpose',                                            'RighteousOrder'],
  ['Power, Grief & the Corruption of Purpose',                   'RighteousOrder'],
  ['Propriety — ethics of craft',                                'Propriety'],
  ['Protection & Vigilance',                                     'RighteousOrder'],
  ['Purification & Balance',                                     'Balance'],
  ['Reciprocity & Forgiveness',                                  'Reciprocity'],
  ['Reciprocity — the relationship between performer and community', 'Reciprocity'],
  ['Reciprocity',                                                'Reciprocity'],
  ['Restoration & Outcast Dignity',                              'RighteousOrder'],
  ['Resurrection as Kemetic Return',                             'RighteousOrder'],
  ['Righteous Defense & Cosmic Order',                           'RighteousOrder'],
  ['Righteous Governance',                                       'RighteousOrder'],
  ['Righteous Purpose',                                          'RighteousOrder'],
  ['Righteous Sovereignty & The Cost of Power',                  'RighteousOrder'],
  ['Righteousness & Elevation',                                  'RighteousOrder'],
  ['Sanctuary & Truth',                                          'RighteousOrder'],
  ['Sovereignty & Freedom',                                      'RighteousOrder'],
  ['Strategic Patience',                                         'RighteousOrder'],
  ['Succession, Tyranny & The Duty to Remove Unjust Rulers',     'RighteousOrder'],
  ['Trade, Exploitation & Where Maat Draws the Line',            'Justice'],
  ['Transformation & Revolutionary Vision',                      'Balance'],
  ['Transformation',                                             'Balance'],
  ['Trust & Responsibility',                                     'Reciprocity'],
  ['Truth & Courage',                                            'Truth'],
  ['Truth & Honesty',                                            'Truth'],
  ['Truth & Justice',                                            'Truth'],
  ['Truth & Memory',                                             'Truth'],
  ['Truth & Mercy',                                              'Truth'],
  ['Truth Against Empire',                                       'Truth'],
  ['Truth — holding two true things without collapsing one',     'Truth'],
  ['Truth — the danger of seeing only one side',                 'Truth'],
  ['Truth',                                                      'Truth'],
  ['Truth, Justice, Balance, Reciprocity',                       'Truth'],
  ['Truth, Justice, Cultural Integrity, Balance',                'Truth'],
  ['Truth, Justice, Cultural Sovereignty, Resistance to Isfet',  'Truth'],
  ['Unity & Justice',                                            'Harmony'],
  ['Unity & Protection',                                         'Harmony'],
  ['Wealth as Obligation & The Corruption of Generosity',        'Reciprocity'],
  ['Wisdom & Sovereignty',                                       'RighteousOrder'],
  ['Wisdom',                                                     'RighteousOrder'],
];

function main(){
  // 1. Every real label resolves to a canonical virtue (not null).
  let allMapped = true;
  for(const [label, expected] of EXPECTED){
    const got = principleToVirtue(label);
    const pass = got === expected;
    if(!pass){ allMapped = false; console.error(`FAIL  "${label}" → ${got} (expected ${expected})`); FAIL++; }
    else PASS++;
  }
  ok(`all ${EXPECTED.length} real labels resolve correctly`, allMapped);

  // 2. Every output is one of the 7 canonical virtues.
  let allCanonical = true;
  for(const [label] of EXPECTED){
    const v = principleToVirtue(label);
    if(!ALL_VIRTUES.includes(v)){ allCanonical = false; console.error(`FAIL  "${label}" → ${v} not in ALL_VIRTUES`); }
  }
  ok('all outputs are canonical 7-virtue names', allCanonical);

  // 3. Null/empty inputs return null.
  ok('null input → null',                  principleToVirtue(null) === null);
  ok('undefined input → null',             principleToVirtue(undefined) === null);
  ok('empty string → null',                principleToVirtue('') === null);
  ok('whitespace-only → null',             principleToVirtue('   ') === null);
  ok('non-string → null',                  principleToVirtue(42) === null);

  // 4. Unknown bare tokens → null.
  ok('gibberish → null',                   principleToVirtue('xyzzy') === null);
  ok('generic word → null',                principleToVirtue('morning') === null);

  // 5. Case/whitespace insensitive.
  ok('UPPERCASE resolves',                 principleToVirtue('TRUTH') === 'Truth');
  ok('mixed case resolves',                principleToVirtue('ReCiProCiTy') === 'Reciprocity');
  ok('extra whitespace resolves',          principleToVirtue('  Balance  ') === 'Balance');

  // 6. Unicode dashes stripped so tokens match.
  ok('em-dash tokenization',               principleToVirtue('Truth — courage') === 'Truth');
  ok('hyphen tokenization',                principleToVirtue('Return-to-Ka Healing') === 'Balance');

  // 7. Maat prefix stripped so next token dominates.
  ok('Maat: Truth resolves to Truth',      principleToVirtue('Maat: Truth') === 'Truth');
  ok('bare "Maat" → RighteousOrder',       principleToVirtue('Maat') === 'RighteousOrder');

  console.log(`\n${PASS} passed, ${FAIL} failed.`);
  process.exit(FAIL === 0 ? 0 : 1);
}

main();
