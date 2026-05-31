#!/usr/bin/env node
// tests/reader-ui-regression.test.mjs
//
// Static regression suite for the SIX post-v3.34.1 UX patches that landed
// without their own assertions — closes the regression-coverage gap Sam
// flagged RED in docs/superpowers/round-tables/2026-04-30-session-enterprise-quality-audit.md.
//
// Sibling to tests/elder-hint-ui-regression.test.mjs (which protects the
// v3.34.1 elder-hint Bug 1-4 patterns). Same brace-walk + grep approach;
// same plain-Node + assert/strict pattern as every other tests/*.test.mjs.
//
// Each fix has at least one POSITIVE assertion (the fix marker IS present).
// Fixes that removed a bug-source pattern (parent sema-pairs) also get a
// NEGATIVE assertion (the bug source is NOT back).
//
// Run: node tests/reader-ui-regression.test.mjs

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

// Fix 1 — Reader back-button mid-checkpoint escape (commit 4a12bae).
// exitReader() MUST clear _checkpointActive and dismiss the overlay
// before calling nav("library"). Without this, the navbar-anti-accident
// guard in nav() silently blocks the user's explicit Back tap.
{
  const fn = extractFunctionBody('exitReader');
  ok('Fix 1: exitReader extracted', !!fn, fn ? `${fn.length} chars` : 'function not found');

  if (fn){
    const hasCheckpointGuard = /if\s*\(\s*this\._checkpointActive\s*\)\s*\{/.test(fn);
    ok('Fix 1: exitReader has the explicit checkpoint-active branch',
       hasCheckpointGuard,
       hasCheckpointGuard ? '' : 'expected if (this._checkpointActive) { ... } — back button will silently fail mid-checkpoint');

    const clearsFlag = /this\._checkpointActive\s*=\s*false/.test(fn);
    ok('Fix 1: exitReader clears _checkpointActive',
       clearsFlag,
       clearsFlag ? '' : 'expected this._checkpointActive = false so nav() guard lets navigation through');

    const hidesContainer = /checkpointContainer[\s\S]{0,80}style\.display\s*=\s*['"]none['"]/.test(fn);
    ok('Fix 1: exitReader hides #checkpointContainer',
       hidesContainer,
       hidesContainer ? '' : 'expected cp.style.display = "none" on the checkpoint overlay');

    const navLast = /this\.nav\(['"]library['"]\)/.test(fn);
    ok('Fix 1: exitReader still calls nav(library)',
       navLast,
       navLast ? '' : 'expected this.nav("library") — the actual navigation call');
  }
}

// Fix 2 — Yeshua's Way reader-photo bump (commit 54ec074, refactored in 744dabb).
// renderChunk MUST tag the spread with dataset.set via the SET_BY_ID_PREFIX
// lookup table (extensible — adding another set is a single line). The CSS
// rules MUST declare wider widths under [data-set="yeshuasWay"].
{
  const tableDriven = /SET_BY_ID_PREFIX\s*=\s*\{[^}]*['"]yeshuas-way-['"]\s*:\s*['"]yeshuasWay['"]/.test(html);
  ok('Fix 2: SET_BY_ID_PREFIX table maps yeshuas-way- -> yeshuasWay (Maya binding)',
     tableDriven,
     tableDriven ? '' : 'expected SET_BY_ID_PREFIX = { "yeshuas-way-": "yeshuasWay" } — table-driven set tagging lost');

  // v3.46.17 white-border audit (RT-driven): the per-level YW photo-bump
  // overrides at 50%/900px (L1-L2), 75%/570px (L3-L4), 52%/420px (L5-L6) were
  // intentionally removed. The base .reader-float-art rule is now 100%/none
  // for every level, eliminating the cream parchment "white border" that
  // showed on every reader picture. The YW set override now reads
  // `width:100%;max-width:none`. The locked invariant going forward: there
  // are NO per-level YW photo-bump max-width clauses.
  const ywBase = /\.reader-spread\[data-set=["']yeshuasWay["']\]\s+\.reader-float-art\s*\{[^}]*max-width:\s*none/.test(html);
  ok('Fix 2 (v3.46.17): YW reader-float-art base rule declares max-width:none',
     ywBase,
     ywBase ? '' : 'expected .reader-spread[data-set="yeshuasWay"] .reader-float-art{...max-width:none} — white-border audit RT binding reverted');

  // Negative invariant: the per-level YW photo-bump clauses must NOT return.
  const stalePerLevelYwBump = /\[data-set=["']yeshuasWay["']\]\[data-level=["']3["']\][^,]*\.reader-float-art[^{]*\{[^}]*max-width:\s*570px/s.test(html)
    || /\[data-set=["']yeshuasWay["']\]\[data-level=["']5["']\][^,]*\.reader-float-art[^{]*\{[^}]*max-width:\s*420px/s.test(html);
  ok('Fix 2 (v3.46.17): per-level YW photo-bump overrides removed (no max-width:570px / 420px)',
     !stalePerLevelYwBump,
     stalePerLevelYwBump ? 'per-level YW photo-bump clauses returned — white-border audit fix regressed' : '');
}

// Fix 3 — Heka brightness (5cf7719) + prefers-contrast (744dabb).
// .heka-word MUST override .word's dark-brown #2C1810 default with a
// bright cream so children can read the passage aloud. The prefers-contrast:
// more media query MUST exist for users with explicit OS preferences.
{
  const baseColor = /\.heka-word\s*\{[^}]*color:\s*#FFF3D6/i.test(html);
  ok('Fix 3: .heka-word base color #FFF3D6 (cream)',
     baseColor,
     baseColor ? '' : 'expected .heka-word{color:#FFF3D6} — children cannot read the heka passage; AA contrast violation returns');

  const baseShadow = /\.heka-word\s*\{[^}]*text-shadow:\s*0\s+1px\s+3px\s+rgba\(0,0,0,\s*\.55\)/i.test(html);
  ok('Fix 3: .heka-word default text-shadow for legibility on gold panel',
     baseShadow,
     baseShadow ? '' : 'expected text-shadow:0 1px 3px rgba(0,0,0,.55) — cream-on-gold loses contrast at glance');

  const contrastQuery = /@media\s*\(prefers-contrast:\s*more\)\s*\{\s*\.heka-word\s*\{[^}]*color:\s*#fff/i.test(html);
  ok('Fix 3: prefers-contrast: more drops shadow + bumps to pure white (Imani binding)',
     contrastQuery,
     contrastQuery ? '' : 'expected @media (prefers-contrast: more){.heka-word{color:#fff;text-shadow:none}} — high-contrast OS preference path lost');

  const stateClasses = /\.heka-word\.current\b/.test(html)
                    && /\.heka-word\.tentative\b/.test(html)
                    && /\.heka-word\.spoken\.accurate\b/.test(html)
                    && /\.heka-word\.spoken\.missed\b/.test(html);
  ok('Fix 3: all four heka state-color rules still present',
     stateClasses,
     stateClasses ? '' : 'expected .heka-word.{current,tentative,spoken.accurate,spoken.missed} — state transition broken');
}

// Fix 4 — Filter heka + sema completions out of parent Response Log
// (commit 39e04cd; reverts the type-badge work from 744dabb).
// v3.51.73 update: the filter now consults App.RESPONSE_LOG_ALLOW (set of
// per-child signal types: reflection/dialogue/challenge/override). heka,
// sema, and heka_* telemetry are still excluded — the contract is unchanged,
// only the implementation widened to also include dialogue/challenge/override
// (the original `type === 'reflection'` literal was over-narrow and rejected
// legitimate Seba-dialogue entries the child had typed).
{
  const fn = extractFunctionBody('_renderGuardianResponseLog');
  ok('Fix 4: _renderGuardianResponseLog extracted', !!fn, fn ? `${fn.length} chars` : 'function not found');

  if (fn){
    const hasAllowFilter = /\.filter\s*\(\s*\w+\s*=>\s*!\w+\.type\s*\|\|\s*App\.RESPONSE_LOG_ALLOW\.has\(\w+\.type\)/.test(fn);
    ok('Fix 4: filter expression keeps per-child signal types (excludes heka/sema/heka_*)',
       hasAllowFilter,
       hasAllowFilter ? '' : 'expected merged.filter(e => !e.type || App.RESPONSE_LOG_ALLOW.has(e.type)) — see v3.51.73');

    const noBadge = !/typeBadge|☥\s*Heka|𓇣\s*Sema/.test(fn);
    ok('Fix 4: no orphan type-badge code (rolled back from 744dabb)',
       noBadge,
       noBadge ? '' : 'type badge code re-introduced — heka/sema rows now visible (regression)');
  }
}

// Fix 5 — Parent portal sema-pairs section removal (commit e3896c3).
// _renderParentSemaPairs function and its HTML container MUST be gone.
// Child-facing sema activity MUST remain (Hall of Truth collection).
{
  const fnGone = !/\b_renderParentSemaPairs\b/.test(html);
  ok('Fix 5: _renderParentSemaPairs function reference fully removed',
     fnGone,
     fnGone ? '' : 'sema-pairs render fn back in parent dashboard — useless rows return');

  const idGone = !/\bid="parentSemaPairs"/.test(html);
  ok('Fix 5: <div id="parentSemaPairs"> HTML container removed',
     idGone,
     idGone ? '' : 'parentSemaPairs HTML container re-added');

  const childSideKept = /\bid="semaPairsCollection"/.test(html);
  ok('Fix 5: child-side semaPairsCollection (Hall of Truth) preserved',
     childSideKept,
     childSideKept ? '' : 'CRITICAL: child-side sema activity destroyed — should only have removed the parent-portal section');

  const childRenderKept = /\b_renderSemaPairs\s*\(\s*\)/.test(html);
  ok('Fix 5: child-side _renderSemaPairs() render call preserved',
     childRenderKept,
     childRenderKept ? '' : 'CRITICAL: child-side sema render call destroyed');
}

// Fix 7 — window.App = App exposure (cherry-pick of feature/senebty-tier-sigils
// 1adea5c → main 2fe60dc). const App = {...} declares App in the global
// lexical scope but NOT on window. External modules (senebty/lib/render.js)
// probe `window.App && typeof window.App.nav === 'function'` — without the
// `window.App = App;` line in maat-reader.html, that probe always fails and
// the Foundations ring falls through to COMING_SOON_MSG instead of navigating
// to Foundation 1 (Mu). This was the root cause of the user-reported
// "Foundation 1 closed" symptom in v3.35.0.
{
  const hasWindowApp = /window\.App\s*=\s*App\s*;/.test(html);
  ok('Fix 7: window.App = App; line present (Foundation 1 entry unblock)',
     hasWindowApp,
     hasWindowApp ? '' : 'expected `window.App = App;` after const App — without it, render.js cannot find App and Foundations ring fails closed');
}

// Fix 8 — Glossary backdrop overlay element (cherry-pick of 1adea5c → 2fe60dc).
// Without #senebtyGlossaryBackdrop, the panel occludes the Senebty content
// rather than reading as a true modal overlay.
{
  const hasBackdropEl = /id="senebtyGlossaryBackdrop"/.test(html);
  ok('Fix 8: <div id="senebtyGlossaryBackdrop"> element present',
     hasBackdropEl,
     hasBackdropEl ? '' : 'expected backdrop element — without it glossary panel occludes Senebty content');
}

// Fix 9 — App.saveUser() alias for save() (post-v3.35.0 hotfix).
// The senebty subsystem (iri.js line 36 + 96, threshold.js, foundation-mu.js,
// streak.js, all senebty/tests/*) calls `this.saveUser()` per the documented
// contract. App had `save()` but not `saveUser()` — so iri.record() succeeded
// at recording WATER_IRI but then threw on the unguarded `this.saveUser()`
// call, blowing up the app on the user's first water-drink action AFTER the
// foundation-mu first-water-drink fix landed. The fix adds saveUser as a
// thin alias on App. This assertion guards against accidental removal.
{
  const hasSaveUserAlias = /saveUser\s*\([^)]*\)\s*\{[^}]*return\s+this\.save\(/.test(html);
  ok('Fix 9: App.saveUser() alias for save() present (senebty contract)',
     hasSaveUserAlias,
     hasSaveUserAlias ? '' : 'expected saveUser(...){ return this.save(...) } on App — without it, iri.record() crashes with "this.saveUser is not a function"');
}

// Fix 6 — Reader page indentation clear:both (commit a5486ce).
// .reader-content.advanced-mode .chunk MUST declare clear:both so each
// chunk starts at the parchment's left padding regardless of whether the
// previous chunk had a left-floated illustration. Title/subtitle/divider
// also get clear:both defensively.
{
  const chunkClear = /\.reader-content\.advanced-mode\s+\.chunk\s*\{[^}]*clear:\s*both/i.test(html);
  ok('Fix 6: advanced-mode .chunk declares clear:both (Maya binding)',
     chunkClear,
     chunkClear ? '' : 'expected .reader-content.advanced-mode .chunk{...clear:both} — float-bleed between chunks returns; left margin wanders');

  const titleClear = /\.reader-page-title\s*\{[^}]*clear:\s*both/i.test(html);
  ok('Fix 6: .reader-page-title declares clear:both (Sam defensive)',
     titleClear,
     titleClear ? '' : 'expected clear:both on .reader-page-title');

  const subtitleClear = /\.reader-page-subtitle\s*\{[^}]*clear:\s*both/i.test(html);
  ok('Fix 6: .reader-page-subtitle declares clear:both (Sam defensive)',
     subtitleClear,
     subtitleClear ? '' : 'expected clear:both on .reader-page-subtitle');

  const dividerClear = /\.reader-divider\s*\{[^}]*clear:\s*both/i.test(html);
  ok('Fix 6: .reader-divider declares clear:both (Sam defensive)',
     dividerClear,
     dividerClear ? '' : 'expected clear:both on .reader-divider');
}

console.log(`\n${PASS}/${PASS+FAIL} passed`);
process.exit(FAIL === 0 ? 0 : 1);
