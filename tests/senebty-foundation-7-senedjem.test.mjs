import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const storySrc = fs.readFileSync('senebty/data/foundations/07-senedjem/story.js', 'utf8');
const moduleSrc = fs.readFileSync('senebty/lib/foundation-senedjem.js', 'utf8');
const html = fs.readFileSync('maat-reader.html', 'utf8');

const m = /const\s+FOUNDATION_SENEDJEM\s*=\s*(\{[\s\S]*?\n\})\s*;?\s*\nif/m.exec(storySrc);
const story = m ? new Function(`return ${m[1]};`)() : null;

check('Story object loadable', () => assert.ok(story));
check('type === "foundation"', () => assert.equal(story.type, 'foundation'));
check('Power Word SENEDJEM', () => assert.equal(story.powerWord, 'SENEDJEM'));
check('iriCheckpoint CREATION_IRI', () => {
  assert.equal(story.iriCheckpoint.iriType, 'CREATION_IRI');
});
check('evidenceShape covers text OR dataURL', () => {
  const shape = story.iriCheckpoint.evidenceShape || {};
  assert.ok('text' in shape && 'dataURL' in shape, 'evidenceShape must include text and dataURL');
});
check('parentConfirmDefault === true', () => {
  assert.equal(story.iriCheckpoint.parentConfirmDefault, true);
});
check('comprehensionPool has at least 6 questions', () => assert.ok(story.comprehensionPool.length >= 6));
check('Story L1 word count 460-560', () => {
  const text = story.chunks.filter(c => c.level === 1).map(c => c.text || '').join(' ');
  const wc = text.split(/\s+/).filter(Boolean).length;
  assert.ok(wc >= 460 && wc <= 560, `L1 word count ${wc} outside 460-560`);
});
check('Africana primary citations include Karenga', () => {
  const cites = JSON.stringify(story.citations || []);
  assert.match(cites, /Karenga/);
});
check('Tone canon NEVER words absent', () => {
  const allText = JSON.stringify(story);
  assert.doesNotMatch(allText, /(great job|amazing|awesome|way to go|you did it|keep going)/i);
});
check('"making sweet" OR "joy as iri" thematic anchor in prose', () => {
  const allText = JSON.stringify(story);
  assert.ok(
    /making.sweet/i.test(allText) || /joy as iri/i.test(allText),
    'F7 prose must include either "making sweet" or "joy as iri" thematic anchor'
  );
});
check('F7 card in maat-reader.html is now --open', () => {
  const idx = html.indexOf('Senedjem — Joy');
  assert.ok(idx > 0, 'F7 card not found');
  const liStart = html.lastIndexOf('<li', idx);
  const liEnd = html.indexOf('</li>', idx);
  const liBlock = html.slice(liStart, liEnd);
  assert.match(liBlock, /senebty-foundation-card--open/);
  assert.doesNotMatch(liBlock, /senebty-foundation-card--coming/);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
