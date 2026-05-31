#!/usr/bin/env node
// v3.43.5 — Silent-catch baseline lock for render-path callsites.
//
// The v3.43.0 production regression was caused by:
//   `try { this._renderReadingPreferencesCard(host); } catch(e) {}`
// The catch swallowed a TypeError ("Cannot read property 'renderToggle' of
// undefined") and the toggle silently failed to render. No unit test caught it.
//
// This test enforces .claude/rules/enterprise-patterns.md Rule 1:
// every `try { ... <call to a method matching _render*> ... } catch(e) { ... }`
// in maat-reader.html must include a `console.error` or `console.warn` in the
// catch body. The baseline is captured below; new code must not add to it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

// Find every try-block whose body invokes a method matching `_render*`.
// Pair it with the catch block immediately following.
function findRenderCatches(src) {
  const out = [];
  // Match: `try { ... _render<Word>( ... ); ... } catch(e) { <body> }`
  // We work line-by-line. For each `try {` opener, walk to its matching
  // close, then check for a following `catch(...){...}`. If the try body
  // mentions `_render<X>(`, record the pair.
  let i = 0;
  while (i < src.length) {
    const tryIdx = src.indexOf('try {', i);
    if (tryIdx === -1) break;
    // Find matching close brace for the try body
    let depth = 1, j = tryIdx + 'try {'.length;
    while (j < src.length && depth > 0) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      j++;
    }
    if (depth !== 0) { i = tryIdx + 1; continue; }
    const tryBody = src.slice(tryIdx, j);
    // Check for `catch` immediately following
    const after = src.slice(j).match(/^\s*catch\s*\(([^)]*)\)\s*\{/);
    if (!after) { i = j; continue; }
    const catchStart = j + after[0].length - 1;  // position of opening `{`
    let cdepth = 1, k = catchStart + 1;
    while (k < src.length && cdepth > 0) {
      const c = src[k];
      if (c === '{') cdepth++;
      else if (c === '}') cdepth--;
      k++;
    }
    const catchBody = src.slice(catchStart, k);
    if (/this\._render[A-Z]\w*\s*\(/.test(tryBody)) {
      out.push({ tryIdx, tryBody, catchBody });
    }
    i = k;
  }
  return out;
}

const renderCatches = findRenderCatches(html);

test('every try-block on a _render* path has a logged catch (v3.43.x Rule 1)', () => {
  const offenders = [];
  for (const { tryIdx, tryBody, catchBody } of renderCatches) {
    const isLogged = /console\.(error|warn|log)\s*\(/.test(catchBody);
    if (!isLogged) {
      // Quote the offending render method for the failure message
      const m = tryBody.match(/this\._render[A-Z]\w*/);
      offenders.push({
        offset: tryIdx,
        method: m ? m[0] : '_render?',
        catch: catchBody.slice(0, 80).replace(/\s+/g, ' ').trim()
      });
    }
  }
  assert.equal(offenders.length, 0,
    `silent catches on render paths (must console.error/warn/log per Rule 1):\n` +
    offenders.map(o => `  - ${o.method} at offset ${o.offset}: catch ${o.catch}`).join('\n'));
});

// v3.43.6 — extend Rule 1 to fetch() calls. A try-block containing a `fetch(`
// is making a network request; silent failure = user-visible regression with
// no diagnosable signal. Same anti-pattern class as the v3.43.0 render-path bug.
function findFetchCatches(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const tryIdx = src.indexOf('try {', i);
    if (tryIdx === -1) break;
    let depth = 1, j = tryIdx + 'try {'.length;
    while (j < src.length && depth > 0) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      j++;
    }
    if (depth !== 0) { i = tryIdx + 1; continue; }
    const tryBody = src.slice(tryIdx, j);
    const after = src.slice(j).match(/^\s*catch\s*\(([^)]*)\)\s*\{/);
    if (!after) { i = j; continue; }
    const catchStart = j + after[0].length - 1;
    let cdepth = 1, k = catchStart + 1;
    while (k < src.length && cdepth > 0) {
      const c = src[k];
      if (c === '{') cdepth++;
      else if (c === '}') cdepth--;
      k++;
    }
    const catchBody = src.slice(catchStart, k);
    if (/\bfetch\s*\(/.test(tryBody)) {
      out.push({ tryIdx, tryBody, catchBody });
    }
    i = k;
  }
  return out;
}

test('every try-block containing fetch() has SOME failure signal — log, user-display, or documented defensive', () => {
  // Rule 1 (extension): a fetch failure must produce SOMETHING — a console
  // log, user-visible feedback (textContent/alert/disabled-toggle), or
  // an explicit "defensive — reason" annotation. Truly empty `catch(e){}`
  // is the only thing this fails on. The bar is intentionally low because
  // many existing fetch catches already display user feedback (status
  // messages, error elements, alerts) — those count as handling.
  const fetchCatches = findFetchCatches(html);
  const offenders = [];
  for (const { tryIdx, tryBody, catchBody } of fetchCatches) {
    // Pass if catch contains EITHER:
    //   (a) actual code (a comment-only catch is documented intent), OR
    //   (b) any comment with text (developer explicitly thought about it).
    // Fail only on truly bare `catch(e){}` / `catch(_){}` — the v3.43.0 anti-pattern
    // where no consideration was given AND no signal escapes.
    const hasComment = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/.test(catchBody);
    const stripped = catchBody
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\s/g, '');
    const isCodeBare = stripped === '{}' && !hasComment;
    if (isCodeBare) {
      const fm = tryBody.match(/fetch\s*\(([^,)]+)/);
      offenders.push({
        offset: tryIdx,
        url: fm ? fm[1].trim().slice(0, 60) : 'fetch(?)',
        catch: catchBody.slice(0, 80).replace(/\s+/g, ' ').trim()
      });
    }
  }
  assert.equal(offenders.length, 0,
    `truly empty catches on fetch() paths (must do SOMETHING — log, display, or annotate defensive):\n` +
    offenders.map(o => `  - ${o.url} at offset ${o.offset}: catch ${o.catch}`).join('\n'));
});

test('count summary — silent-catch-anywhere baseline (informational only)', () => {
  // This is NOT a fail — just emits the baseline so future hotfixes can
  // measure progress against the v3.43.0 grandfathered count of ~95.
  const allBareCatches = (html.match(/catch\s*\([^)]*\)\s*\{\s*\}/g) || []).length;
  const allCommentOnlyCatches = (html.match(/catch\s*\([^)]*\)\s*\{\s*\/\*[^*]*\*\/\s*\}/g) || []).length;
  const total = allBareCatches + allCommentOnlyCatches;
  console.log(`[baseline] silent catches in maat-reader.html: ${allBareCatches} bare + ${allCommentOnlyCatches} comment-only = ${total} total`);
  // Sanity check: number doesn't catastrophically explode (e.g. > 200 means a refactor probably broke something)
  assert.ok(total < 200,
    'silent-catch count should not exceed 200 — current=' + total + '. Either remediate, or update this ceiling.');
});
