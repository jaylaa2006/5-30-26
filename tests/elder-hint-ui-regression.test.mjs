#!/usr/bin/env node
// tests/elder-hint-ui-regression.test.mjs
//
// Static regression suite for the v3.34.1 Elder Hint UI fixes (Bug 1 single-Seba,
// Bug 2 replace-not-stack, Bug 3 null-defense, Bug 4 ankh spacing).
// Binding from docs/superpowers/round-tables/2026-04-29-enterprise-stability-audit.md (Sam).
//
// This is the cheaper sibling of a true jsdom integration test. It loads
// maat-reader.html as text and asserts the FIX PATTERNS are still present:
//   - the bug-source code we removed is NOT back
//   - the fix-marker code we added IS still there
//   - the CSS rule we widened HAS the wider value
//
// If a future commit accidentally reverts any fix, this suite goes red.
// It does not replace a true DOM-render test (deferred to v3.36 cycle), but
// it floors the regression risk for the four bugs that escaped audit on 2026-04-29.
//
// Run: node tests/elder-hint-ui-regression.test.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = resolve(here, '..', 'maat-reader.html');
const html = readFileSync(HTML_PATH, 'utf8');

let PASS = 0, FAIL = 0;
function ok(name, cond, detail){
  (cond ? console.log : console.error)(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  cond ? PASS++ : FAIL++;
}

// Slice a function body out of the inline JS by name.
// Walks brace depth from the opening `{` of `_funcName(...) {` until the
// matching `}`. Used to scope assertions to specific functions instead of
// grepping the whole 5.9MB document.
function extractFunctionBody(name){
  const re = new RegExp(`\\b${name}\\b\\s*\\([^)]*\\)\\s*\\{`, 'g');
  const m = re.exec(html);
  if (!m) return null;
  let depth = 0;
  const start = m.index + m[0].length - 1;
  for (let i = start; i < html.length; i++){
    const c = html[i];
    if (c === '{') depth++;
    else if (c === '}'){
      depth--;
      if (depth === 0) return html.slice(m.index, i + 1);
    }
  }
  return null;
}

// Bug 1 — Single-Seba evaluation rendering.
// _displaySebaEvaluation and _displayFallbackEvaluation MUST NOT contain
// a fresh `.guide-wrap.compact.guide-intro` block (that produced the
// duplicate Seba avatar). The fix swaps text into the existing top
// bubble via textContent.
{
  const eval1 = extractFunctionBody('_displaySebaEvaluation');
  const eval2 = extractFunctionBody('_displayFallbackEvaluation');
  ok('Bug 1: _displaySebaEvaluation extracted', !!eval1, eval1 ? `${eval1.length} chars` : 'function not found');
  ok('Bug 1: _displayFallbackEvaluation extracted', !!eval2, eval2 ? `${eval2.length} chars` : 'function not found');

  if (eval1){
    const hasDupGuideWrap = /guide-wrap\s+compact\s+guide-intro/.test(eval1);
    ok('Bug 1: _displaySebaEvaluation does NOT re-render guide-intro Seba',
       !hasDupGuideWrap,
       hasDupGuideWrap ? 'duplicate guide-wrap.compact.guide-intro template detected' : 'clean');
    const hasBubbleSwap = /introBubbleText\.textContent\s*=\s*response/.test(eval1);
    ok('Bug 1: _displaySebaEvaluation swaps text into existing bubble',
       hasBubbleSwap,
       hasBubbleSwap ? '' : 'expected `introBubbleText.textContent = response` — fix may have been reverted');
    const hasAriaLive = /introBubbleText\.setAttribute\(['"]aria-live['"]\s*,\s*['"]polite['"]/.test(eval1);
    ok('Bug 1: aria-live="polite" set before bubble swap (Tehuti binding)',
       hasAriaLive,
       hasAriaLive ? '' : 'expected aria-live polite on swap — a11y binding lost');
  }
  if (eval2){
    const hasDupGuideWrap = /guide-wrap\s+compact\s+guide-intro/.test(eval2);
    ok('Bug 1: _displayFallbackEvaluation does NOT re-render guide-intro Seba',
       !hasDupGuideWrap,
       hasDupGuideWrap ? 'duplicate guide-wrap.compact.guide-intro template detected' : 'clean');
  }
}

// Bug 2 — Replace-not-stack hint cards.
// _activateElderHint MUST find prior `.elder-hint-card` and replace, NOT
// append. Detected by presence of `replaced-by-hint-2` fallback_reason
// (only emitted in the replace path) AND absence of the `lastCard` /
// `insertAfter` pattern that produced the stacking bug.
{
  const fn = extractFunctionBody('_activateElderHint');
  ok('Bug 2: _activateElderHint extracted', !!fn, fn ? `${fn.length} chars` : 'function not found');

  if (fn){
    const hasReplacedReason = /['"]replaced-by-hint-2['"]/.test(fn);
    ok('Bug 2: replace path emits dismissed beacon with fallback_reason replaced-by-hint-2 (Sam binding)',
       hasReplacedReason,
       hasReplacedReason ? '' : 'replace-prior beacon not detected — Bug 2 fix reverted');

    const hasSrLive = /Seba offers a deeper teaching, replacing the first guidance/.test(fn);
    ok('Bug 2: SR-live announcement on replace (Tehuti binding)',
       hasSrLive,
       hasSrLive ? '' : 'expected SR-live announcement string — a11y binding lost');

    const hasDatasetStamp = /card\.dataset\.shownAt\s*=\s*String\(Date\.now\(\)\)/.test(fn);
    ok('Bug 2: new card stamped with dataset.shownAt (next-cycle telemetry)',
       hasDatasetStamp,
       hasDatasetStamp ? '' : 'expected card.dataset.shownAt = String(Date.now()) — replace cycle metadata lost');

    const hasOldStackPattern = /lastCard\s*=\s*wrap\.parentNode\.querySelector\([^)]*last-of-type/.test(fn);
    ok('Bug 2: NO last-of-type append pattern (the stacking bug)',
       !hasOldStackPattern,
       hasOldStackPattern ? 'old `lastCard = ...last-of-type` append pattern back — Bug 2 has regressed' : 'clean');
  }
}

// Bug 3 — Null-defense when both AI and pool return empty.
// _activateElderHint MUST bail before rendering when hint is null/empty,
// restore the ankh affordance for retry, and emit a beacon with
// fallback_reason 'no-hint-available' so recurrence is measurable.
{
  const fn = extractFunctionBody('_activateElderHint');
  if (fn){
    const hasNullGuard = /typeof\s+hint\s*!==\s*['"]string['"]\s*\|\|\s*!hint\.trim\(\)/.test(fn);
    ok('Bug 3: null-defense guards typeof hint !== string || empty',
       hasNullGuard,
       hasNullGuard ? '' : 'expected null/empty guard before render — Bug 3 will recur');

    const hasNoHintBeacon = /['"]no-hint-available['"]/.test(fn);
    ok('Bug 3: emits beacon with fallback_reason no-hint-available',
       hasNoHintBeacon,
       hasNoHintBeacon ? '' : 'expected no-hint-available fallback_reason for measurability');

    const hasAnkhRestore = /ankhEl\.classList\.remove\(['"]thinking['"]\s*,\s*['"]used['"]\)/.test(fn);
    ok('Bug 3: ankh affordance restored for retry',
       hasAnkhRestore,
       hasAnkhRestore ? '' : 'expected ankhEl.classList.remove("thinking", "used") — child cannot retry');
  }
}

// Bug 5 (v3.40.2 hotfix) — _startElderHintTimer must clear BEFORE setting ctx.
// Audit 2026-05-01: prior order nulled _elderHintCtx immediately after it was
// set, because _clearElderHintTimers wipes ctx. Effect: every ankh tap fired
// with checkpointType:undefined → API 400 → pool null → null-defense bailed
// → ankhs "don't open." This static-pattern test asserts the ordering only;
// a jsdom integration test would be stronger but this catches the regression
// shape (clear must precede ctx assignment in _startElderHintTimer).
{
  const fnMatch = /_startElderHintTimer\([^)]*\)\s*\{([\s\S]*?)\n\s{2}\},/.exec(html);
  ok('Bug 5: _startElderHintTimer extracted', !!fnMatch);
  if (fnMatch){
    const fn = fnMatch[1];
    const clearIdx = fn.indexOf('_clearElderHintTimers()');
    const ctxIdx = fn.indexOf('this._elderHintCtx = {');
    ok('Bug 5: _clearElderHintTimers() called inside _startElderHintTimer',
       clearIdx > -1, 'expected _clearElderHintTimers() invocation');
    ok('Bug 5: this._elderHintCtx assignment present',
       ctxIdx > -1, 'expected this._elderHintCtx = { container, type, contextData }');
    ok('Bug 5: _clearElderHintTimers() runs BEFORE _elderHintCtx is set (else ctx is wiped)',
       clearIdx > -1 && ctxIdx > -1 && clearIdx < ctxIdx,
       `clear at ${clearIdx}, ctx-set at ${ctxIdx} — ctx must be set AFTER clear, not before`);
  }
}

// Bug 4 — Ankh wrap gap widened so halos don't overlap.
// .elder-hint-wrap CSS rule must have gap:32px (was 14px which made two
// 76px-effective sparkle halos overlap by ~6px).
{
  const ruleMatch = /\.elder-hint-wrap\s*\{[^}]*\}/.exec(html);
  ok('Bug 4: .elder-hint-wrap CSS rule found', !!ruleMatch);
  if (ruleMatch){
    const rule = ruleMatch[0];
    const gapMatch = /gap:\s*(\d+)px/.exec(rule);
    ok('Bug 4: .elder-hint-wrap declares gap', !!gapMatch, gapMatch ? `gap:${gapMatch[1]}px` : 'no gap declared');
    if (gapMatch){
      const gap = parseInt(gapMatch[1], 10);
      ok('Bug 4: .elder-hint-wrap gap >= 24px (sparkle halos don\'t overlap)',
         gap >= 24,
         `gap=${gap}px (need >=24px; sparkle box inset:-10px = 76px effective)`);
    }
  }
}

console.log(`\n${PASS}/${PASS+FAIL} passed`);
process.exit(FAIL === 0 ? 0 : 1);
