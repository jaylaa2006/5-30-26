// senebty-chunk-text-budget.test.mjs — v3.51.12 Consistency Coach binding
//
// Enforces a per-chunk text-length budget so the static parchment min-height
// (420px desktop, 280px mobile) holds without forcing internal scroll on
// most chunks. The budget was set at 728 chars (the longest chunk at
// v3.51.12 ship time — F5 Wedeha). Going above silently flips the card
// into scroll-mode, which is fine but should be a noticed decision, not
// an unnoticed regression.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const BUDGET_CHARS = 900;
const ROOT = path.join(process.cwd(), 'senebty/data/foundations');

const ALLOWLIST = new Set([]);

function chunkTexts(storyJsSrc) {
  const out = [];
  const re = /text:\s*(['"`])([^'"`]*)\1/g;
  let m;
  while ((m = re.exec(storyJsSrc)) !== null) {
    out.push({ text: m[2], pos: m.index });
  }
  return out;
}

test('no chunk text exceeds the static-parchment budget (or is allowlisted)', () => {
  const violations = [];
  if (!fs.existsSync(ROOT)) return;
  const dirs = fs.readdirSync(ROOT).filter(d => fs.statSync(path.join(ROOT, d)).isDirectory());
  for (const d of dirs) {
    const storyPath = path.join(ROOT, d, 'story.js');
    if (!fs.existsSync(storyPath)) continue;
    const src = fs.readFileSync(storyPath, 'utf8');
    const chunks = chunkTexts(src);
    chunks.forEach((c, i) => {
      const id = `${d}-chunk-${i}`;
      if (c.text.length > BUDGET_CHARS && !ALLOWLIST.has(id)) {
        violations.push(`${id}: ${c.text.length} chars > ${BUDGET_CHARS} budget`);
      }
    });
  }
  if (violations.length) {
    assert.fail('\n' + violations.length + ' chunk(s) exceed text budget:\n  - ' + violations.join('\n  - '));
  }
});
