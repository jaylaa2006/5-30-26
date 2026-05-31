import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const storySrc = fs.readFileSync('senebty/data/foundations/08-heka/story.js', 'utf8');
const moduleSrc = fs.readFileSync('senebty/lib/foundation-heka.js', 'utf8');
const html = fs.readFileSync('maat-reader.html', 'utf8');

const m = /const\s+FOUNDATION_HEKA\s*=\s*(\{[\s\S]*?\n\})\s*;?\s*\nif/m.exec(storySrc);
const story = m ? new Function(`return ${m[1]};`)() : null;

check('Story object loadable', () => assert.ok(story));
check('type === "foundation"', () => assert.equal(story.type, 'foundation'));
check('Power Word HEKA', () => assert.equal(story.powerWord, 'HEKA'));
check('iriCheckpoint TEACHING_IRI', () => assert.equal(story.iriCheckpoint.iriType, 'TEACHING_IRI'));
check('parentConfirmDefault === true', () => assert.equal(story.iriCheckpoint.parentConfirmDefault, true));
check('comprehensionPool has at least 6 questions', () => assert.ok(story.comprehensionPool.length >= 6));
check('Story L1 word count 510-610', () => {
  const text = story.chunks.filter(c => c.level === 1).map(c => c.text || '').join(' ');
  const wc = text.split(/\s+/).filter(Boolean).length;
  assert.ok(wc >= 510 && wc <= 610, `L1 word count ${wc} outside 510-610`);
});
check('Africana primary citations include Karenga', () => {
  const cites = JSON.stringify(story.citations || []);
  assert.match(cites, /Karenga/);
});
check('Tone canon NEVER words absent', () => {
  const allText = JSON.stringify(story);
  assert.doesNotMatch(allText, /(great job|amazing|awesome|way to go|you did it|keep going)/i);
});
check('"Speech creates reality" thematic anchor present in prose', () => {
  const allText = JSON.stringify(story);
  assert.match(allText, /(speech.*creat|speech.*real|words.*creat|words.*world|voice.*shapes|authoritative speech)/i);
});
check('Child-teaches-parent arc present in prose', () => {
  const allText = JSON.stringify(story);
  assert.match(allText, /(teach|show.*parent|show.*sibling|teach.*home|teach.*one)/i);
});
check('F8 card in maat-reader.html is now --open', () => {
  const idx = html.indexOf('Heka - Words of Power');
  const idxEm = html.indexOf('Heka — Words of Power');
  const useIdx = idx > 0 ? idx : idxEm;
  assert.ok(useIdx > 0, 'F8 card not found');
  const liStart = html.lastIndexOf('<li', useIdx);
  const liBlock = html.slice(liStart, useIdx + 200);
  assert.match(liBlock, /senebty-foundation-card--open/);
  assert.doesNotMatch(liBlock, /senebty-foundation-card--coming/);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
