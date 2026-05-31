// Yeshua's Way (+ Learn-More, shared .yw-layout) mobile scroll fix (v3.51.58).
// Regression lock: on phones the 60/40 grid must collapse to one column and
// .yw-chapter-list must NOT be a nested scroll container (max-height +
// overflow-y:auto), which trapped every vertical swipe so the page couldn't
// scroll. User report 2026-05-20: "i cant scroll up and down on yeshuas way
// library on mobile."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

test('base .yw-chapter-list is a desktop nested scroll container (max-height + overflow-y:auto)', () => {
  // This is the desktop design; the mobile media query must override it.
  assert.match(html, /\.yw-chapter-list\{[^}]*max-height:\s*calc\(100vh[^}]*overflow-y:\s*auto/,
    'desktop .yw-chapter-list should keep its scroll container (the thing we override on mobile)');
});

test('a max-width:600px media query collapses .yw-layout to one column', () => {
  // Find a <=600px media block that sets yw-layout to a single column.
  const m = html.match(/@media\s*\(max-width:\s*600px\)\s*\{[\s\S]*?\.yw-layout\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.ok(m, 'a max-width:600px block must set .yw-layout grid-template-columns:1fr');
});

test('mobile media query removes the .yw-chapter-list nested scroll (max-height:none + overflow:visible)', () => {
  const block = html.match(/@media\s*\(max-width:\s*600px\)\s*\{[\s\S]*?\.yw-chapter-list\s*\{([^}]*)\}/);
  assert.ok(block, 'mobile block must override .yw-chapter-list');
  assert.match(block[1], /max-height:\s*none/, 'mobile must drop the max-height (no nested scroll)');
  assert.match(block[1], /overflow:\s*visible/, 'mobile must set overflow:visible (page scrolls as one)');
});

test('mobile media query shrinks the chapter thumb to fit narrow width', () => {
  const block = html.match(/@media\s*\(max-width:\s*600px\)\s*\{[\s\S]*?\.yw-chapter-card\s+\.ch-thumb\s*\{([^}]*)\}/);
  assert.ok(block, 'mobile block should resize .ch-thumb');
  assert.match(block[1], /width:\s*\d+px/, 'ch-thumb width must shrink on mobile');
});

test('SW APP_VERSION at v39 for v3.51.83', () => {
  const sw = fs.readFileSync('public/sw.js', 'utf8');
  assert.match(sw, /APP_VERSION\s*=\s*'v39'/,
    'public/sw.js APP_VERSION must be v38 for the v3.51.83 sample-cards badge-style match ship');
});
