// senebty-medu-column-overflow.test.mjs — v3.51.11 Consistency Coach binding
//
// Regression guard for the v3.51.11 medu-netr overflow defect. The papyrus's
// ::before renders a vertical hieroglyph column at position absolute. With
// too many glyphs OR font-size too large, the column overflows past the
// papyrus bottom on short chunks (2-line sebaIntro) and lands against the
// screen-left margin. v3.51.11 reduced 6 → 3 glyphs AND added overflow:hidden.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const CSS = fs.readFileSync(path.join(process.cwd(), 'senebty/styles/senebty.css'), 'utf8');

function extractBeforeBlock() {
  const idx = CSS.indexOf('.senebty-foundation-copy::before');
  if (idx < 0) return null;
  const openBrace = CSS.indexOf('{', idx);
  const closeBrace = CSS.indexOf('}', openBrace);
  return CSS.slice(openBrace, closeBrace);
}

test('medu column max 3 glyphs (short-chunk overflow safety)', () => {
  const block = extractBeforeBlock();
  assert.ok(block, '.senebty-foundation-copy::before block found');
  const contentMatch = block.match(/content:\s*'([^']+)'/);
  assert.ok(contentMatch, 'content property present');
  const content = contentMatch[1];
  const glyphs = content.split(/\\A/).filter(g => g.trim().length > 0);
  assert.ok(glyphs.length <= 3,
    `medu column has ${glyphs.length} glyphs; MAX is 3 per v3.51.11. ` +
    `Adding a 4th requires bumping papyrus min-height or reducing font further.`);
});

test('medu column font-size max 1.1rem (sizing budget)', () => {
  const block = extractBeforeBlock();
  const fsMatch = block.match(/font-size:\s*([\d.]+)\s*rem/);
  assert.ok(fsMatch, 'font-size in rem present');
  const fontRem = parseFloat(fsMatch[1]);
  assert.ok(fontRem <= 1.1, `medu column font-size ${fontRem}rem > 1.1rem budget. Raising it risks short-chunk overflow.`);
});

test('papyrus parent scrolls long chunks (overflow-y:auto)', () => {
  // v3.51.35 — superseded the v3.51.11 belt-and-suspenders overflow:hidden
  // assertion. The medu hieroglyph column ::before is now `display: none`
  // (v3.51.16), so the clip-everything fallback is no longer needed AND
  // was actively breaking the long-chunk scroll path (user-reported text
  // cut-off on F1 Mu chunk-0). Main rule's overflow-y:auto is now the
  // contract: long chunks scroll inside the parchment via the styled
  // parchment-fiber scrollbar (scrollbar-width:thin + scrollbar-color).
  const mainRuleRe = /\.senebty-foundation-copy\s*\{[^}]*overflow-y:\s*auto/m;
  assert.match(CSS, mainRuleRe,
    'main .senebty-foundation-copy rule must declare overflow-y:auto so long chunks scroll');
  // And the regressive belt-and-suspenders MUST NOT come back as a
  // standalone short-form override (it would clobber the scroll).
  const regressionRe = /\.senebty-foundation-copy\s*\{\s*overflow:\s*hidden\s*;?\s*\}/;
  assert.doesNotMatch(CSS, regressionRe,
    'standalone `overflow: hidden` shorthand override would re-break long-chunk scroll');
});
