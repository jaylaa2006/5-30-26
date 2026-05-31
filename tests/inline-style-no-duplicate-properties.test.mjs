#!/usr/bin/env node
// v3.44.3 — Lint test: no inline style attribute may declare the same
// CSS property twice. Caught by the v3.44.2 sweep agent: #homeMaatDetail
// had `style="display:none;...;display:flex"` which (per CSS spec)
// resolves to `display:flex` because the LAST declaration wins. Result
// was a visible empty flex container before JS could hide it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

test('v3.44.3 — no inline style attribute declares the same property twice', () => {
  const offenders = [];
  const matches = html.matchAll(/style="([^"]*)"/g);
  for (const m of matches) {
    const style = m[1];
    if (!style.includes(':')) continue;
    const props = style
      .split(';')
      .map(p => p.split(':')[0].trim().toLowerCase())
      .filter(Boolean);
    const seen = {};
    for (const p of props) seen[p] = (seen[p] || 0) + 1;
    const dupes = Object.keys(seen).filter(k => seen[k] > 1);
    if (dupes.length) {
      const lineNum = html.slice(0, m.index).split('\n').length;
      offenders.push({ line: lineNum, dupes, style: style.slice(0, 120) });
    }
  }
  assert.equal(offenders.length, 0,
    'inline style attributes with duplicate properties (last declaration wins, masking earlier ones — common source of "element starts visible despite display:none" bugs):\n' +
    offenders.map(o => `  L${o.line}: dupes=${JSON.stringify(o.dupes)}  style=${o.style}`).join('\n'));
});

// v3.44.4 superseded the #homeMaatDetail-specific regression test:
// the element was removed entirely from the home page (the broken-spike
// fix). The element-absent invariant is locked by
// tests/home-virtue-star-gate.test.mjs, and the broader "no duplicate
// properties anywhere" lint above still catches the bug class for any
// future inline style attribute.
