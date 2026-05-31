#!/usr/bin/env node
// Structural validator for the Medjay Strength & Justice arc stories.
// Loads maat-reader.html, pulls the STORIES array literal with a scoped
// Function evaluator, and asserts each expected story conforms to the
// L4 shape established by medjay-grain-thief.

import fs from 'node:fs';
import assert from 'node:assert/strict';

// STORIES was extracted to public/js/stories.js for perf (2026-05-23). Read both so
// STORIES (now in stories.js) + STORY_SETS/strengthJustice (still in the HTML) resolve.
const HTML = fs.readFileSync(new URL('../maat-reader.html', import.meta.url), 'utf8')
  + '\n' + fs.readFileSync(new URL('../public/js/stories.js', import.meta.url), 'utf8');

// Extract the STORIES array literal. Robust-enough: find 'var STORIES = [',
// then walk brackets until balanced.
function extractStoriesLiteral(src) {
  const marker = 'var STORIES = [';
  const start = src.indexOf(marker);
  if (start === -1) throw new Error('var STORIES = [ not found');
  let i = start + marker.length - 1; // on the opening '['
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return src.slice(start + marker.length - 1, i + 1);
    }
  }
  throw new Error('STORIES array never closes');
}

const literal = extractStoriesLiteral(HTML);
const STORIES = Function('"use strict"; return (' + literal + ');')();

const EXPECTED_IDS_PHASE_1 = [
  'ahmose-desert-scout',
  'siege-of-avaris',
  'thutmose-first-boundary-stone'
];

const EXPECTED_IDS_PHASE_2 = [
  'watcher-of-karnak',
  'valley-of-the-kings-oath',
  'hatshepsut-shield-bearer'
];

const EXPECTED_IDS = [...EXPECTED_IDS_PHASE_1, ...EXPECTED_IDS_PHASE_2];

let PASS = 0, FAIL = 0;
function check(name, fn) {
  try { fn(); console.log('PASS ' + name); PASS++; }
  catch (e) { console.error('FAIL ' + name + ' — ' + e.message); FAIL++; }
}

for (const id of EXPECTED_IDS) {
  const story = STORIES.find(s => s?.id === id);
  check(`${id} exists in STORIES`, () => assert.ok(story, `no story with id ${id}`));
  if (!story) continue;
  check(`${id} is level 4 / grade 6`, () => {
    assert.equal(story.level, 4);
    assert.equal(story.grade, 6);
  });
  check(`${id} has 21-24 chunks`, () => {
    assert.ok(Array.isArray(story.chunks), 'chunks must be an array');
    assert.ok(story.chunks.length >= 21 && story.chunks.length <= 24,
      `chunks.length=${story.chunks.length}, expected 21-24`);
  });
  check(`${id} every chunk has non-empty text`, () => {
    for (const [i, c] of story.chunks.entries()) {
      assert.ok(typeof c.text === 'string' && c.text.length > 100,
        `chunk ${i} text too short: ${c.text?.slice(0, 40)}`);
    }
  });
  check(`${id} has comprehensionPool with 4 groups`, () => {
    assert.ok(Array.isArray(story.comprehensionPool));
    assert.equal(story.comprehensionPool.length, 4,
      `expected 4 comprehension groups, got ${story.comprehensionPool.length}`);
    for (const grp of story.comprehensionPool) {
      assert.ok(Array.isArray(grp.questions) && grp.questions.length === 2,
        'each comprehension group needs exactly 2 questions');
    }
  });
  check(`${id} has 3 maatReflections`, () => {
    assert.ok(Array.isArray(story.maatReflections));
    assert.equal(story.maatReflections.length, 3);
    for (const r of story.maatReflections) {
      assert.ok(r.prompt && r.principle && r.sebaIntro);
      assert.ok(typeof r.minimumWords === 'number' && r.minimumWords >= 20);
    }
  });
  check(`${id} scene key is valid`, () => {
    const validScenes = new Set(['scene-battle','scene-desert','scene-garden','scene-knowledge','scene-nile','scene-stars','scene-temple','scene-village']);
    assert.ok(validScenes.has(story.scene), `unknown scene: ${story.scene}`);
  });
}

// STORY_SETS presence check
check('STORY_SETS.strengthJustice exists', () => {
  assert.ok(HTML.includes("strengthJustice:"), 'strengthJustice entry missing');
  assert.ok(HTML.includes("'ahmose-desert-scout'"), 'id not referenced in set');
});

// sebaGuides presence check — each story needs a guide block
for (const id of EXPECTED_IDS) {
  check(`sebaGuides["${id}"] exists`, () => {
    assert.ok(HTML.includes(`'${id}':[`) || HTML.includes(`"${id}":[`),
      `sebaGuides entry missing for ${id}`);
  });
}

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
