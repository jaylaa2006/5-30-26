import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const storySrc = fs.readFileSync('senebty/data/foundations/02-four-treasures/story.js', 'utf8');
const moduleSrc = fs.readFileSync('senebty/lib/foundation-four-treasures.js', 'utf8');
const html = fs.readFileSync('maat-reader.html', 'utf8');

const m = /\bconst\s+FOUNDATION_FOUR_TREASURES\s*=\s*(\{[\s\S]*?\n\})\s*;\s*\n\s*if\s*\(\s*typeof\s+window/m.exec(storySrc);
const story = m ? new Function(`return ${m[1]};`)() : null;

check('Story object loadable', () => assert.ok(story));
check('type === "foundation"', () => assert.equal(story.type, 'foundation'));
check('Power Word KHAT', () => assert.equal(story.powerWord, 'KHAT'));
check('iriCheckpoint is BODY_IRI', () => assert.equal(story.iriCheckpoint.iriType, 'BODY_IRI'));
check('iriCheckpoint redesigned: tap-each-treasure-card pattern (NOT body-locations)', () => {
  const promptText = story.iriCheckpoint.prompt || '';
  assert.match(promptText, /tap (each|the four|all four)|treasure|recite|name/i);
  assert.doesNotMatch(promptText, /(forehead|abdomen|chest)/i);
});
check('comprehensionPool has at least 6 questions', () => assert.ok(story.comprehensionPool.length >= 6));
check('Story L1 word count 430-530', () => {
  const text = story.chunks.filter(c => c.level === 1).map(c => c.text || '').join(' ');
  const wc = text.split(/\s+/).filter(Boolean).length;
  assert.ok(wc >= 430 && wc <= 530, `L1 word count ${wc} outside 430-530`);
});
check('Africana primary citations present', () => {
  const cites = JSON.stringify(story.citations || []);
  assert.match(cites, /Karenga/);
  assert.match(cites, /Carruthers|Obenga|Finch/);
});
check('Tone canon NEVER words absent', () => {
  const allText = JSON.stringify(story);
  assert.doesNotMatch(allText, /(great job|amazing|awesome|way to go|you did it|keep going|🎉|✨|🌟)/i);
});
check('Transparency note about pedagogical-quartet present', () => {
  const allText = JSON.stringify(story);
  assert.match(allText, /(Akh|Ren|Sheut)/i);
  assert.match(allText, /(working set|pedagogical|seven|other)/i);
});
check('F2 card in maat-reader.html is now --open', () => {
  const idx = html.indexOf('Four Treasures — Body');
  assert.ok(idx > 0, 'F2 card not found');
  const liStart = html.lastIndexOf('<li', idx);
  const liBlock = html.slice(liStart, idx + 200);
  assert.match(liBlock, /senebty-foundation-card--open/, 'F2 must have --open class');
  assert.doesNotMatch(liBlock, /senebty-foundation-card--coming/, 'F2 must NOT have --coming class');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
