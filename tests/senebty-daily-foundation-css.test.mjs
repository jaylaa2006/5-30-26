import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('senebty/styles/daily-foundation.css', 'utf8');

test('container class', () => assert.match(css, /\.senebty-daily-foundation\s*\{/));
test('greeting card class', () => assert.match(css, /\.senebty-df-greeting\s*\{/));
test('micro-teaching card class', () => assert.match(css, /\.senebty-df-micro\s*\{/));
test('doing-veo card class', () => assert.match(css, /\.senebty-df-doing\s*\{/));
test('honor-check button class', () => assert.match(css, /\.senebty-df-honor\s*\{/));
test('sage-blessing card class', () => assert.match(css, /\.senebty-df-blessing\s*\{/));
test('cinematic-fade transition keyframe', () => assert.match(css, /@keyframes\s+senebty-df-fade/));
test('prefers-reduced-motion override', () => assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/));
test('honor-check button ≥44px tap target', () => {
  const block = css.match(/\.senebty-df-honor\s*\{([^}]+)\}/);
  assert.ok(block);
  assert.match(block[1], /min-height:\s*(?:4[4-9]|[5-9]\d|\d{3,})px/, 'min-height ≥44px (WCAG 2.5.5)');
});
test('continue button class with ≥44px min-height', () => {
  assert.match(css, /\.senebty-df-continue\s*\{/);
  const block = css.match(/\.senebty-df-continue\s*\{([^}]+)\}/);
  assert.ok(block);
  assert.match(block[1], /min-height:\s*(?:4[4-9]|[5-9]\d|\d{3,})px/);
});
test('breath chamber classes + breathing keyframe', () => {
  assert.match(css, /\.senebty-df-breath\s*\{/);
  assert.match(css, /\.senebty-df-breath__guide\s*\{/);
  assert.match(css, /@keyframes\s+senebty-df-breathe/);
});
test('voice-demo classes + ≥44px play button', () => {
  assert.match(css, /\.senebty-df-voicedemo\s*\{/);
  const b = css.match(/\.senebty-df-voicedemo__play\s*\{([^}]+)\}/);
  assert.ok(b);
  assert.match(b[1], /min-height:\s*(?:4[4-9]|[5-9]\d|\d{3,})px/);
});
test('affirmation classes + ≥44px choice button', () => {
  assert.match(css, /\.senebty-df-affirm\s*\{/);
  const b = css.match(/\.senebty-df-affirm__choice\s*\{([^}]+)\}/);
  assert.ok(b);
  assert.match(b[1], /min-height:\s*(?:4[4-9]|[5-9]\d|\d{3,})px/);
});
test('reduced-motion disables breathing animation', () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*senebty-df-breath__guide/);
});
