// tests/senebty-threshold-khaemwaset.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const storySrc = fs.readFileSync('senebty/data/threshold/khaemwaset/story.js', 'utf8');
const moduleSrc = fs.readFileSync('senebty/lib/threshold-khaemwaset.js', 'utf8');

const matched = /\bconst\s+KHAEMWASET_THRESHOLD\s*=\s*(\{[\s\S]*?\n\})\s*;\s*\n\s*if\s*\(\s*typeof\s+window/m.exec(storySrc);
const story = matched ? new Function(`return ${matched[1]};`)() : null;

check('Story object loadable', () => {
  assert.ok(story, 'KHAEMWASET_THRESHOLD constant not extractable');
});

check('type === "threshold"', () => {
  assert.equal(story.type, 'threshold');
});

check('Power Word SENEB', () => {
  assert.equal(story.powerWord, 'SENEB');
});

check('iriCheckpoint is BREATH_IRI 60s', () => {
  assert.equal(story.iriCheckpoint.iriType, 'BREATH_IRI');
  assert.equal(story.iriCheckpoint.durationSeconds, 60);
});

check('comprehensionPool has 6 questions', () => {
  assert.equal(story.comprehensionPool.length, 6);
});

check('Seba copy contains Memphite Ptah anchor', () => {
  const allCopy = JSON.stringify(story);
  assert.match(allCopy, /Ptah spoke/);
  assert.match(allCopy, /world was made/);
  assert.match(allCopy, /Khaemwaset breathed with Ra/);
});

check('Story length L1 Threshold (3 chunks, ~80wpc)', () => {
  // User-locked prose totals 237 words across 3 chunks (~79 wpc avg).
  // L1 Threshold is a 3-chunk pre-F1 onboarding, NOT a full L1 story (which is 12 chunks @ 80-100 wpc).
  // Range tracks the verbatim user-approved prose register.
  const text = story.chunks.map(c => c.text || '').join(' ');
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  assert.ok(wordCount >= 220 && wordCount <= 280, `Word count ${wordCount} outside 220-280 range`);
});

check('Tone canon NEVER words absent', () => {
  const allText = JSON.stringify(story);
  const NEVER = /(great job|amazing|awesome|way to go|you did it|keep going|🎉|✨|🌟)/i;
  assert.doesNotMatch(allText, NEVER);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
