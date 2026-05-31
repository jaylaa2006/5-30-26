#!/usr/bin/env node
// tests/library-fully-unlocked.test.mjs
// 2026-05-15 — v3.46.6: general library is fully unlocked. Sequential-lock
// progression remains ONLY on the Pert em Heru / Sage Pert em Heru sets.
// Yeshua's Way is also free-walk (per v3.40.1, unchanged).
//
// This test pins the change so a future refactor cannot silently reinstate
// the `s.level > lvl + 2` gate on the general library.
//
// Run: node --test tests/library-fully-unlocked.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const HTML = fs.readFileSync('maat-reader.html', 'utf8');

// Pull a generous window after the named anchor — wide enough that long
// renderers (renderYeshuasWay, renderSagePertEmHeru) include their tail.
function blockOf(name, windowBytes = 14000) {
  const idx = HTML.indexOf(name);
  if (idx < 0) throw new Error('handler not found: ' + name);
  return HTML.slice(idx, idx + windowBytes);
}

test('renderLibrary: card-list `locked` is unconditionally false', () => {
  const body = blockOf('renderLibrary(){');
  // No surviving `s.level > lvl + 2` gate inside the library handler.
  assert.doesNotMatch(body, /const locked = s\.level > lvl \+ 2/,
    'level-based gate must be removed from the library card render');
  // The replacement is explicit: `const locked = false;`.
  assert.match(body, /const locked = false;/,
    'library card render must declare locked = false (audit-traceable)');
});

test('_renderLibraryFeatured: featured-card has no lock-state branches', () => {
  // Scope strictly to the _renderLibraryFeatured body — downstream PEH list
  // legitimately uses `locked` for its sequential gate, so a 14k window
  // would bleed and falsely fail.
  const start = HTML.indexOf('_renderLibraryFeatured(storyIdx');
  assert.ok(start > 0, '_renderLibraryFeatured must exist');
  const end = HTML.indexOf('\n  _storyDesc(', start);
  assert.ok(end > start, '_storyDesc helper must follow as the function-end anchor');
  const body = HTML.slice(start, end);
  assert.doesNotMatch(body, /const locked = s\.level > lvl \+ 2/,
    'level-based gate must be removed from the featured card render');
  // v3.46.16 — featured renderer refactored to pure DOM construction; the
  // `locked` variable is gone entirely (no lock overlay rendered, no
  // disabled button branch). Pin: there must be no level-gate logic AND
  // no `locked ? ... : ...` ternaries that could reinstate a lock branch.
  assert.doesNotMatch(body, /\blocked\s*\?\s*/,
    'no `locked ? ...` ternary branches may reinstate lock paths');
});

test('renderPertEmHeru: sequential-lock (prevDone) preserved', () => {
  const body = blockOf('renderPertEmHeru(){');
  // The PEH sequential gate is exactly: prevDone OR done.
  assert.match(body,
    /const prevDone = vi === 0 \|\| this\.user\.storiesRead\.includes\(pertStories\[vi-1\]\.s\.id\)/,
    'Pert em Heru must still derive prevDone from the previous chapter');
  assert.match(body, /const locked = !prevDone && !done/,
    'Pert em Heru must still gate access on !prevDone && !done');
});

test('renderSagePertEmHeru: sequential-lock (prevDone) preserved', () => {
  const body = blockOf('renderSagePertEmHeru(){');
  assert.match(body,
    /const prevDone = vi === 0 \|\| this\.user\.storiesRead\.includes\(sageStories\[vi-1\]\.s\.id\)/,
    'Sage Pert em Heru must still derive prevDone from the previous chapter');
});

test('renderYeshuasWay: continues to be free-walk (locked=false, prior v3.40.1)', () => {
  // The YW renderer is long; pull from the function start to the next
  // top-level `,\n  ` so we cover the entire body.
  const idx = HTML.indexOf('renderYeshuasWay(){');
  assert.ok(idx > 0, 'renderYeshuasWay must exist');
  const next = HTML.indexOf('\n  ', idx + 6000);  // wider window than blockOf
  const body = HTML.slice(idx, next > 0 ? next : idx + 12000);
  assert.match(body, /ywStories\.forEach\(\(\{s, i\}, vi\) => \{[\s\S]{0,500}const locked = false;/,
    "Yeshua's Way must remain free-walk (its own prior decision)");
});

console.log('[library-fully-unlocked] all assertions passed');
