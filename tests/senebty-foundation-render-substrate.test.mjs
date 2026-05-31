// tests/senebty-foundation-render-substrate.test.mjs
// M3 substrate fix: assert that foundation modules' render() reads from
// window.Senebty.<x>Story and that the data files are wired into maat-reader.html
// BEFORE the lib script tags (data must load first).
import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const html = fs.readFileSync('maat-reader.html', 'utf8');

check('All 4 story.js scripts wired into maat-reader.html', () => {
  for (const path of [
    'senebty/data/threshold/khaemwaset/story.js',
    'senebty/data/foundations/02-four-treasures/story.js',
    'senebty/data/foundations/03-tjau/story.js',
    'senebty/data/foundations/04-mu-streak/story.js',
  ]) {
    assert.ok(html.includes(path), `Missing script tag for ${path}`);
  }
});

check('Threshold story.js loads BEFORE threshold-khaemwaset.js lib', () => {
  const dataIdx = html.indexOf('senebty/data/threshold/khaemwaset/story.js');
  const libIdx = html.indexOf('senebty/lib/threshold-khaemwaset.js');
  assert.ok(dataIdx > 0, 'Threshold data script tag missing');
  assert.ok(libIdx > 0, 'Threshold lib script tag missing');
  assert.ok(dataIdx < libIdx, 'Data must load before lib');
});

check('F2 story.js loads BEFORE foundation-four-treasures.js lib', () => {
  const dataIdx = html.indexOf('senebty/data/foundations/02-four-treasures/story.js');
  const libIdx = html.indexOf('senebty/lib/foundation-four-treasures.js');
  assert.ok(dataIdx < libIdx, 'F2 data must load before lib');
});

check('F3 story.js loads BEFORE foundation-tjau.js lib', () => {
  const dataIdx = html.indexOf('senebty/data/foundations/03-tjau/story.js');
  const libIdx = html.indexOf('senebty/lib/foundation-tjau.js');
  assert.ok(dataIdx < libIdx, 'F3 data must load before lib');
});

check('F4 story.js loads BEFORE foundation-mu-streak.js lib', () => {
  const dataIdx = html.indexOf('senebty/data/foundations/04-mu-streak/story.js');
  const libIdx = html.indexOf('senebty/lib/foundation-mu-streak.js');
  assert.ok(dataIdx < libIdx, 'F4 data must load before lib');
});

check('Foundation modules read window.Senebty.<x>Story', () => {
  for (const [file, key] of [
    ['senebty/lib/foundation-four-treasures.js', 'foundationFourTreasuresStory'],
    ['senebty/lib/foundation-tjau.js', 'foundationTjauStory'],
    ['senebty/lib/foundation-mu-streak.js', 'foundationMuStreakStory'],
    ['senebty/lib/threshold-khaemwaset.js', 'khaemwasetThresholdStory'],
  ]) {
    const src = fs.readFileSync(file, 'utf8');
    assert.match(src, new RegExp(`Senebty\\.${key}`),
      `${file} must reference Senebty.${key}`);
  }
});

check('story.js files expose to window.Senebty namespace', () => {
  for (const [file, key] of [
    ['senebty/data/threshold/khaemwaset/story.js', 'khaemwasetThresholdStory'],
    ['senebty/data/foundations/02-four-treasures/story.js', 'foundationFourTreasuresStory'],
    ['senebty/data/foundations/03-tjau/story.js', 'foundationTjauStory'],
    ['senebty/data/foundations/04-mu-streak/story.js', 'foundationMuStreakStory'],
  ]) {
    const src = fs.readFileSync(file, 'utf8');
    assert.match(src, new RegExp(`window\\.Senebty[\\s\\S]{0,200}\\.${key}\\s*=`),
      `${file} must expose to window.Senebty.${key}`);
  }
});

check('story.js files expose CommonJS export for Node tests', () => {
  for (const [file, key] of [
    ['senebty/data/threshold/khaemwaset/story.js', 'KHAEMWASET_THRESHOLD'],
    ['senebty/data/foundations/02-four-treasures/story.js', 'FOUNDATION_FOUR_TREASURES'],
    ['senebty/data/foundations/03-tjau/story.js', 'FOUNDATION_TJAU'],
    ['senebty/data/foundations/04-mu-streak/story.js', 'FOUNDATION_MU_STREAK'],
  ]) {
    const src = fs.readFileSync(file, 'utf8');
    assert.match(src, new RegExp(`module\\.exports\\s*=\\s*\\{\\s*${key}`),
      `${file} must export ${key} for Node`);
  }
});

check('senebtyFoundation dispatch routes khaemwaset key to threshold module', () => {
  assert.match(html, /_fkey === 'khaemwaset'[\s\S]{0,200}thresholdKhaemwaset\.render/,
    'senebtyFoundation handler must route khaemwaset → thresholdKhaemwaset.render');
});

check('Foundation render() does NOT inline placeholder treasure literals', () => {
  // Substrate fix means literals like the OLD inlined TREASURES array must come
  // from somewhere generic, not be the only source of content. Render must
  // reference the story object (chunks/comprehensionPool/iriCheckpoint).
  for (const file of [
    'senebty/lib/foundation-four-treasures.js',
    'senebty/lib/foundation-tjau.js',
    'senebty/lib/foundation-mu-streak.js',
    'senebty/lib/threshold-khaemwaset.js',
  ]) {
    const src = fs.readFileSync(file, 'utf8');
    assert.match(src, /story\.chunks|story\.comprehensionPool|story\.iriCheckpoint/,
      `${file} render() must consume story.chunks / comprehensionPool / iriCheckpoint`);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
