import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const storySrc = fs.readFileSync('senebty/data/foundations/06-hesi/story.js', 'utf8');
const moduleSrc = fs.readFileSync('senebty/lib/foundation-hesi.js', 'utf8');
const html = fs.readFileSync('maat-reader.html', 'utf8');

const m = /const\s+FOUNDATION_HESI\s*=\s*(\{[\s\S]*?\n\})\s*;?\s*\nif/m.exec(storySrc);
const story = m ? new Function(`return ${m[1]};`)() : null;

check('Story object loadable', () => assert.ok(story));
check('type === "foundation"', () => assert.equal(story.type, 'foundation'));
check('Power Word HESI', () => assert.equal(story.powerWord, 'HESI'));
check('powerWordPron null (M1 RT NONE — text-only ship)', () => {
  assert.ok(story.powerWordPron === null || story.powerWordPron === undefined);
});
check('iriCheckpoint VOICE_IRI score-only', () => {
  assert.equal(story.iriCheckpoint.iriType, 'VOICE_IRI');
  assert.ok(!('audioRetention' in story.iriCheckpoint) || !story.iriCheckpoint.audioRetention);
});
check('comprehensionPool has at least 6 questions', () => assert.ok(story.comprehensionPool.length >= 6));
check('Story L1 word count 490-590', () => {
  const text = story.chunks.filter(c => c.level === 1).map(c => c.text || '').join(' ');
  const wc = text.split(/\s+/).filter(Boolean).length;
  assert.ok(wc >= 490 && wc <= 590, `L1 word count ${wc} outside 490-590`);
});
check('Africana primary citations include Finch', () => {
  const cites = JSON.stringify(story.citations || []);
  assert.match(cites, /Finch/);
});
check('Tone canon NEVER words absent', () => {
  const allText = JSON.stringify(story);
  assert.doesNotMatch(allText, /(great job|amazing|awesome|way to go|you did it|keep going)/i);
});
check('Hesi voice-toning OR modern-adaptation disclosure present in prose', () => {
  const allText = JSON.stringify(story);
  assert.ok(
    /(voice.toning|listening to the voice|sunu.+voice|voice as devotion)/i.test(allText) ||
    /(modern|contemporary).*(adaptation|practice|technique|pattern)/i.test(allText),
    'F6 must include either voice-toning Africana anchor OR explicit modern-adaptation disclosure (Finch binding)'
  );
});
check('F6 card in maat-reader.html is now --open', () => {
  const idx = html.indexOf('Hesi — Voice');
  assert.ok(idx > 0, 'F6 card not found');
  const liStart = html.lastIndexOf('<li', idx);
  const liBlock = html.slice(liStart, idx + 200);
  assert.match(liBlock, /senebty-foundation-card--open/);
  assert.doesNotMatch(liBlock, /senebty-foundation-card--coming/);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
