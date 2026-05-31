import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const storySrc = fs.readFileSync('senebty/data/foundations/04-mu-streak/story.js', 'utf8');
const moduleSrc = fs.readFileSync('senebty/lib/foundation-mu-streak.js', 'utf8');
const html = fs.readFileSync('maat-reader.html', 'utf8');

const m = /\bconst\s+FOUNDATION_MU_STREAK\s*=\s*(\{[\s\S]*?\n\})\s*;\s*\n\s*if\s*\(\s*typeof\s+window/m.exec(storySrc);
const story = m ? new Function(`return ${m[1]};`)() : null;

check('Story object loadable', () => assert.ok(story));
check('type === "foundation"', () => assert.equal(story.type, 'foundation'));
check('Power Word MU', () => assert.equal(story.powerWord, 'MU'));
check('iriCheckpoint is STREAK_IRI 21 days', () => {
  assert.equal(story.iriCheckpoint.iriType, 'STREAK_IRI');
  assert.equal(story.iriCheckpoint.daysRequired, 21);
});
check('comprehensionPool has at least 6 questions', () => assert.ok(story.comprehensionPool.length >= 6));
check('Story L1 word count 510-610', () => {
  const text = story.chunks.filter(c => c.level === 1).map(c => c.text || '').join(' ');
  const wc = text.split(/\s+/).filter(Boolean).length;
  assert.ok(wc >= 510 && wc <= 610, `L1 word count ${wc} outside 510-610`);
});
check('Africana primary citations (Diop + others)', () => {
  const cites = JSON.stringify(story.citations || []);
  assert.match(cites, /Diop/);
  assert.match(cites, /Karenga|Obenga/);
});
check('Tone canon NEVER words absent', () => {
  const allText = JSON.stringify(story);
  assert.doesNotMatch(allText, /(great job|amazing|awesome|way to go|you did it|keep going)/i);
});
check('"Memory becomes body" thematic tie present', () => {
  const allText = JSON.stringify(story);
  assert.match(allText, /memory.*becomes.*body|memory.+body|body.*memory/i);
});
check('F4 card in maat-reader.html is now --open', () => {
  const idx = html.indexOf('Mu — Streak');
  assert.ok(idx > 0, 'F4 card not found');
  const liStart = html.lastIndexOf('<li', idx);
  const liBlock = html.slice(liStart, idx + 200);
  assert.match(liBlock, /senebty-foundation-card--open/);
  assert.doesNotMatch(liBlock, /senebty-foundation-card--coming/);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
