import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const storySrc = fs.readFileSync('senebty/data/foundations/03-tjau/story.js', 'utf8');
const moduleSrc = fs.readFileSync('senebty/lib/foundation-tjau.js', 'utf8');
const html = fs.readFileSync('maat-reader.html', 'utf8');

const m = /\bconst\s+FOUNDATION_TJAU\s*=\s*(\{[\s\S]*?\n\})\s*;\s*\n\s*if\s*\(\s*typeof\s+window/m.exec(storySrc);
const story = m ? new Function(`return ${m[1]};`)() : null;

check('Story object loadable', () => assert.ok(story));
check('type === "foundation"', () => assert.equal(story.type, 'foundation'));
check('Power Word TJAU', () => assert.equal(story.powerWord, 'TJAU'));
check('Power Word pron is null/disabled (M1 RT NONE verdict)', () => {
  assert.ok(story.powerWordPron === null || story.powerWordPron === undefined,
    'Tjau pron must be null/undefined per M1 RT (text-only ship)');
});
check('iriCheckpoint is BREATH_IRI 180s', () => {
  assert.equal(story.iriCheckpoint.iriType, 'BREATH_IRI');
  assert.equal(story.iriCheckpoint.durationSeconds, 180);
});
check('iriCheckpoint references 4-7-8 pattern', () => {
  const promptText = (story.iriCheckpoint.prompt || '') + ' ' + (story.iriCheckpoint.pattern || '');
  assert.match(promptText, /4-?7-?8/);
});
check('4-7-8 contemporary-adaptation disclosure present (Finch binding)', () => {
  const allText = JSON.stringify(story);
  assert.match(allText, /(modern|contemporary).*(adaptation|practice|technique|pattern)/i,
    '4-7-8 must be disclosed as modern/contemporary');
  assert.match(allText, /(not ancient|not Kemetic|modern)/i,
    'Must clarify the count is not ancient Kemetic');
});
check('comprehensionPool has at least 6 questions', () => assert.ok(story.comprehensionPool.length >= 6));
check('Story L1 word count 470-570', () => {
  const text = story.chunks.filter(c => c.level === 1).map(c => c.text || '').join(' ');
  const wc = text.split(/\s+/).filter(Boolean).length;
  assert.ok(wc >= 470 && wc <= 570, `L1 word count ${wc} outside 470-570`);
});
check('Africana primary citations present (Finch + others)', () => {
  const cites = JSON.stringify(story.citations || []);
  assert.match(cites, /Finch/);
  assert.match(cites, /Karenga|Obenga|Carruthers/);
});
check('Tone canon NEVER words absent', () => {
  const allText = JSON.stringify(story);
  assert.doesNotMatch(allText, /(great job|amazing|awesome|way to go|you did it|keep going)/i);
});
check('F3 card in maat-reader.html is now --open', () => {
  const idx = html.indexOf('Tjau — Extended Breath');
  assert.ok(idx > 0, 'F3 card not found');
  const liStart = html.lastIndexOf('<li', idx);
  const liBlock = html.slice(liStart, idx + 200);
  assert.match(liBlock, /senebty-foundation-card--open/);
  assert.doesNotMatch(liBlock, /senebty-foundation-card--coming/);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
