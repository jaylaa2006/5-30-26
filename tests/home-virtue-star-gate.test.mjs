#!/usr/bin/env node
// v3.44.2 → v3.44.4 — Home virtue-star chart REMOVED from home page.
//
// History:
//   v3.44.2: tightened the home-render gate to require ≥3 distinct virtues
//            + total ≥5 demonstrations. Reduced the bug surface but didn't
//            fix it — when the gate passed with sparse data, the polygon
//            still read as a thin shape because the rings/axes opacity
//            (0.12-0.15) was nearly invisible on the dark home background.
//   v3.44.3: removed the duplicate display: declaration so initial-paint
//            state wasn't a brief empty flex container.
//   v3.44.4: removed the home virtue-star chart entirely (this test).
//            Full chart lives on Achievements (size 240) and Parent
//            Portal (size 280) where the lighter card backgrounds make
//            the rings/axes legible.
//
// This test locks the removal and verifies achievements/parent renderers
// remain unchanged.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

test('v3.44.4 — homeMaatDetail host element is removed (no leak surface)', () => {
  // The element should not exist anymore. The replacement is an HTML comment
  // documenting why it was removed.
  assert.doesNotMatch(html, /id="homeMaatDetail"/,
    '#homeMaatDetail element must not exist on home');
  // The replacement comment should be present so future contributors don't
  // re-add the element by accident.
  assert.match(html, /v3\.44\.4 — virtue-star radar chart removed from home page/,
    'removal comment present where homeMaatDetail used to live');
});

test('v3.44.4 — renderHome no longer references homeMaatDetail', () => {
  // The render block that wrote .innerHTML / .style.display on
  // homeMaatDetail must be gone too — otherwise the JS would silently
  // no-op (getElementById returns null) but pollute the codebase.
  const renderBlock = html.match(/\n  renderHome\(\)\{[\s\S]+?\n  \},/);
  assert.ok(renderBlock, 'renderHome body found');
  assert.doesNotMatch(renderBlock[0], /homeMaatDetail/,
    'renderHome must not reference the removed element');
});

test('v3.44.4 — virtue-star is still rendered on Achievements + Parent (unchanged)', () => {
  // Ensure the removal did NOT regress the achievements / parent renders.
  assert.match(html, /_buildVirtueStarSVG\(virtues, \{size:280[^}]*id:'virtueStarParent'\}\)/,
    'parent dashboard virtue-star still rendered (size 280)');
  assert.match(html, /_buildVirtueStarSVG\([^)]+\{size:240[^}]*id:'virtueStarAch'\}\)/,
    'achievements virtue-star still rendered (size 240)');
});
