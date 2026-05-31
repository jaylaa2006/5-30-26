#!/usr/bin/env node
// tests/senebty-medium-info-btn.test.mjs
//
// Asserts the "verification pending" info button renders for medium-confidence
// glossary entries. Cultural Consensus binding from the v3.37.0 2nd-eyes
// deploy-gate (`docs/superpowers/round-tables/2026-05-01-v3-37-0-2nd-eyes-deploy-gate.md`):
// the honest framing of a medium-confidence glyph status MUST reach the child,
// not just the engineer reading the source. The silent gold dot the renderer
// previously emitted was engineer-visible only.
//
// Test surface:
//   - For each medium-confidence entry, assert info-btn rendered with the
//     verification-pending aria-label
//   - For high-confidence entries, no info-btn renders
//   - For none-confidence entries, the existing "compound title" info-btn
//     still renders (path NOT broken by the medium addition)
//   - The info-btn--medium variant carries its own modifier class so CSS
//     can differentiate (smaller / softer than the none-variant)

import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');

let PASS = 0, FAIL = 0;
function ok(name, cond, detail){
  (cond ? console.log : console.error)(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  cond ? PASS++ : FAIL++;
}
function check(name, fn){ try { fn(); ok(name, true); } catch (e) { ok(name, false, e?.message || String(e)); } }

function buildDom(){
  // Mirror the live panel DOM the renderer expects, plus #senebtyGlossaryList
  // (where entries are appended) and #senebtyGlossaryRecent (recent-lookup
  // strip — not under test here but rendering would error without the node).
  const dom = new JSDOM(`
    <!DOCTYPE html><html><body>
      <div id="senebty">
        <button id="senebtyGlossaryToggle" aria-expanded="false">Names</button>
      </div>
      <div id="senebtyGlossaryBackdrop" class="senebty-gloss-backdrop" aria-hidden="true"></div>
      <div id="senebtyGlossaryPanel" class="senebty-gloss-panel" aria-hidden="true">
        <button class="senebty-gloss-panel__close">×</button>
        <input id="senebtyGlossarySearch" type="search" />
        <div id="senebtyGlossaryChips"></div>
        <div id="senebtyGlossaryRecent"></div>
        <div id="senebtyGlossaryList"></div>
        <p id="senebtyGlossaryCite"></p>
        <p id="senebtyGlossaryConfidence"></p>
      </div>
    </body></html>
  `, { url: 'http://localhost/' });
  dom.window.sessionStorage.clear();
  return dom;
}

function loadModule(dom, relPath){
  const src = readFileSync(resolve(ROOT, relPath), 'utf8');
  const fn = new dom.window.Function(
    'window', 'document', 'navigator', 'matchMedia', 'localStorage', 'sessionStorage',
    src + '\n//# sourceURL=' + relPath
  );
  fn.call(dom.window, dom.window, dom.window.document, dom.window.navigator,
    dom.window.matchMedia || (() => ({ matches:false, addListener(){}, removeListener(){} })),
    dom.window.localStorage, dom.window.sessionStorage);
}

const dom = buildDom();
loadModule(dom, 'senebty/lib/namespace.js');
loadModule(dom, 'senebty/lib/glossary-entries.js');
loadModule(dom, 'senebty/lib/glossary-panel.js');

// init triggers _renderList; the panel doesn't need to be open for entries
// to render into #senebtyGlossaryList — that's by design (search-as-you-type
// works whether the panel is open or closed).
dom.window.Senebty.glossaryPanel.init();

const list = dom.window.document.getElementById('senebtyGlossaryList');

function entryRow(key){
  return list.querySelector(`.senebty-gloss-entry[data-key="${key}"]`);
}

// Confidence partitions reflect the M1 RT 2026-05-04 verdicts on top of
// the Phase 1.2 closure (docs/superpowers/round-tables/2026-05-04-senebty-
// m1-cultural-consensus-glyph-verdicts.md):
//   Phase 1.2 — high: iri, mu, htep, khepesh, khat, wabau, senebty, seneb
//   Phase 1.2 — medium: tjau, hesi, sunu      (sunu still medium post-M1)
//   Phase 1.2 — none:   senedjem
//   M1 — tjau, hesi → NONE (Africana primary silent in-repo; ship text-only)
//   M1 — heka      → HIGH (Karenga *Maat* widely-known; new entry added)
const HIGH_KEYS   = ['iri','mu','htep','khepesh','khat','wabau','senebty','seneb','heka'];
const MEDIUM_KEYS = ['sunu'];
const NONE_KEYS   = ['senedjem','tjau','hesi'];

check('all 13 entries render at least one row', () => {
  const rows = list.querySelectorAll('.senebty-gloss-entry');
  if (rows.length < 13) throw new Error('only ' + rows.length + ' rows rendered');
});

for (const key of MEDIUM_KEYS){
  check(`medium entry "${key}" renders an info-btn (--medium variant)`, () => {
    const row = entryRow(key);
    if (!row) throw new Error('row not found for key=' + key);
    const btn = row.querySelector('button.senebty-gloss-entry__info-btn--medium');
    if (!btn) throw new Error('info-btn--medium not present in row');
  });
  check(`medium entry "${key}" info-btn has verification-pending aria-label`, () => {
    const row = entryRow(key);
    const btn = row.querySelector('button.senebty-gloss-entry__info-btn--medium');
    const label = btn.getAttribute('aria-label') || '';
    if (!/phonetic spelling/i.test(label)) throw new Error('aria-label missing "phonetic spelling": ' + label);
    if (!/Africana/i.test(label))           throw new Error('aria-label missing "Africana": ' + label);
    if (!/finding the right/i.test(label))  throw new Error('aria-label missing "finding the right": ' + label);
  });
  check(`medium entry "${key}" info-btn textContent is "?"`, () => {
    const row = entryRow(key);
    const btn = row.querySelector('button.senebty-gloss-entry__info-btn--medium');
    if (btn.textContent !== '?') throw new Error('textContent=' + btn.textContent);
  });
  check(`medium entry "${key}" still emits the small gold dot for visual continuity`, () => {
    const row = entryRow(key);
    const dot = row.querySelector('.senebty-gloss-entry__medium-dot');
    if (!dot) throw new Error('medium-dot missing');
  });
}

for (const key of HIGH_KEYS){
  check(`high entry "${key}" does NOT render any info-btn`, () => {
    const row = entryRow(key);
    if (!row) throw new Error('row not found for key=' + key);
    const btn = row.querySelector('button.senebty-gloss-entry__info-btn');
    if (btn) throw new Error('info-btn unexpectedly present on high-confidence entry');
  });
  check(`high entry "${key}" does NOT carry the medium-dot`, () => {
    const row = entryRow(key);
    const dot = row.querySelector('.senebty-gloss-entry__medium-dot');
    if (dot) throw new Error('medium-dot unexpectedly present on high entry');
  });
}

for (const key of NONE_KEYS){
  check(`none entry "${key}" still renders the existing none-variant info-btn (not broken)`, () => {
    const row = entryRow(key);
    if (!row) throw new Error('row not found for key=' + key);
    const btn = row.querySelector('button.senebty-gloss-entry__info-btn');
    if (!btn) throw new Error('none-variant info-btn missing');
    // Must NOT be the --medium variant
    if (btn.classList.contains('senebty-gloss-entry__info-btn--medium')) {
      throw new Error('none entry incorrectly marked as --medium variant');
    }
  });
  check(`none entry "${key}" info-btn carries the "no hieroglyph available" aria-label`, () => {
    const row = entryRow(key);
    const btn = row.querySelector('button.senebty-gloss-entry__info-btn');
    const label = btn.getAttribute('aria-label') || '';
    if (!/no hieroglyph available/i.test(label)) throw new Error('aria-label changed: ' + label);
  });
}

// ── v3.39.0 — Seba TTS routing (Imani + Beatty + Parent-Voice binding) ──
// Click handlers should prefer App.speakKemeticGlyphStatus(name, conf) over
// the legacy speakKemeticWord(name, entry). Verifies kid-friendly Parent-
// Voice wording reaches the spoken path, not just the screen-reader aria.
{
  const calls = [];
  dom.window.App = {
    speakKemeticGlyphStatus(name, conf){ calls.push({ method:'status', name, conf }); },
    speakKemeticWord(word, entry){ calls.push({ method:'word', word, entry: entry?.name }); }
  };

  // medium tap → routes to speakKemeticGlyphStatus with conf='medium'
  // (Sunu is the only remaining medium-confidence entry post-M1 verdicts.)
  const sunuBtn = entryRow('sunu').querySelector('button.senebty-gloss-entry__info-btn--medium');
  sunuBtn.dispatchEvent(new dom.window.Event('click', { bubbles:true }));
  check('v3.39: medium info-btn tap calls App.speakKemeticGlyphStatus (not legacy speakKemeticWord)', () => {
    const last = calls[calls.length - 1];
    if (!last) throw new Error('no call recorded');
    if (last.method !== 'status') throw new Error('routed to ' + last.method + ', expected status');
    if (last.conf !== 'medium') throw new Error('conf=' + last.conf + ', expected medium');
    if (last.name !== 'Sunu') throw new Error('name=' + last.name + ', expected Sunu');
  });

  // none tap → routes to speakKemeticGlyphStatus with conf='none'
  const senedjemBtn = entryRow('senedjem').querySelector('button.senebty-gloss-entry__info-btn');
  senedjemBtn.dispatchEvent(new dom.window.Event('click', { bubbles:true }));
  check('v3.39: none info-btn tap calls App.speakKemeticGlyphStatus(name, "none")', () => {
    const last = calls[calls.length - 1];
    if (last.method !== 'status') throw new Error('routed to ' + last.method);
    if (last.conf !== 'none') throw new Error('conf=' + last.conf);
    if (last.name !== 'Senedjem') throw new Error('name=' + last.name);
  });

  // legacy fallback path: if speakKemeticGlyphStatus is missing, fall back to speakKemeticWord
  // Re-uses sunu (only remaining medium-confidence entry post-M1 verdicts).
  const calls2 = [];
  dom.window.App = {
    speakKemeticWord(word, entry){ calls2.push({ word, entry: entry?.name }); }
  };
  const sunuBtn2 = entryRow('sunu').querySelector('button.senebty-gloss-entry__info-btn--medium');
  sunuBtn2.dispatchEvent(new dom.window.Event('click', { bubbles:true }));
  check('v3.39: legacy fallback — when speakKemeticGlyphStatus is absent, calls speakKemeticWord', () => {
    if (calls2.length !== 1) throw new Error('fallback not invoked, calls=' + calls2.length);
    if (calls2[0].word !== 'Sunu') throw new Error('word=' + calls2[0].word);
  });
}

console.log(`\n${PASS}/${PASS+FAIL} passed`);
process.exit(FAIL === 0 ? 0 : 1);
