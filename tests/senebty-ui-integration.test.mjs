#!/usr/bin/env node
// tests/senebty-ui-integration.test.mjs
//
// jsdom-based integration test for the Senebty section's wiring layer.
// Catches the class of bug that the v3.34.1 + v3.35.0 user walkthroughs
// surfaced — bugs the static-pattern regression suites couldn't catch
// because they're about RUNTIME DOM behavior, not source-text patterns.
//
// Imani's binding from the v3.35.0 2nd-eyes deploy-gate round-table:
// "Add an integration test that asserts the user can actually navigate
// the new feature surface, not just that the source has the fix string."
//
// Strategy:
//   - Construct a minimal jsdom DOM with the Senebty HTML stubs the
//     render.js / glossary-panel.js / foundation-mu.js modules expect
//   - Load each module into the jsdom window via fs + Function (no
//     real script tags — keeps test fast + deterministic). The Function
//     dynamic-input is local source files under version control, NOT
//     user input — this is a test harness, not a runtime path.
//   - Mock window.App with the minimum surface: nav (spy), user, _iri,
//     saveUser
//   - Assert the 5 integration points that have bitten us:
//      1. render.gate populates the tier badge with sigil img (alt + src)
//      2. Foundations ring click → window.App.nav called with the right args
//         (regression for the v3.35.0 `window.App = App` fix)
//      3. Locked ring click → modal opens with lockMsg (NOT COMING_SOON_MSG)
//      4. glossaryPanel.open() adds is-open to BOTH panel AND backdrop
//         (regression for the v3.35.0 backdrop fix)
//      5. foundation-mu.complete(app) calls app._iri.record.call(app)
//         (regression for the v3.35.0 first-water-drink crash fix —
//         records WATER_IRI without throwing)
//
// Run: node tests/senebty-ui-integration.test.mjs

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
function check(name, fn){
  try { fn(); ok(name, true); }
  catch (e) { ok(name, false, (e && e.message) || String(e)); }
}

function buildDom(){
  const dom = new JSDOM(`
    <!DOCTYPE html><html><body>
      <button id="senebtyGlossaryToggle" aria-expanded="false">Names</button>
      <div id="senebty">
        <div class="senebty-gate">
          <div class="senebty-tier-badge">
            <span class="senebty-tier-badge__glyph" id="senebtyTierGlyph">𓋴𓎟</span>
            <span id="senebtyTierName">Hem-Sba</span>
          </div>
          <p class="senebty-gate__seba" id="senebtyGateSeba">old text</p>
          <div class="senebty-rings" id="senebtyRings" aria-label="Senebty rings"></div>
        </div>
      </div>
      <div id="senebtyGlossaryBackdrop" class="senebty-gloss-backdrop" aria-hidden="true"></div>
      <div id="senebtyGlossaryPanel" class="senebty-gloss-panel" aria-hidden="true">
        <button class="senebty-gloss-panel__close">×</button>
        <input id="senebtyGlossarySearch" type="search" />
      </div>
    </body></html>
  `, { url: 'http://localhost/' });

  dom.window.sessionStorage.clear();
  dom.window.localStorage.clear();
  return dom;
}

// Load a senebty/lib/*.js IIFE into the jsdom window context.
// Source files are under version control; this is test-harness code.
function loadModule(dom, relPath){
  const src = readFileSync(resolve(ROOT, relPath), 'utf8');
  const fn = new dom.window.Function(
    'window', 'document', 'navigator', 'matchMedia', 'localStorage', 'sessionStorage',
    src + '\n//# sourceURL=' + relPath
  );
  fn.call(
    dom.window,
    dom.window,
    dom.window.document,
    dom.window.navigator,
    dom.window.matchMedia || (() => ({ matches:false, addListener(){}, removeListener(){} })),
    dom.window.localStorage,
    dom.window.sessionStorage
  );
}

function installTiers(dom){
  dom.window.Senebty = dom.window.Senebty || {};
  dom.window.Senebty.tiers = [
    { key:'hem-sba',         displayName:'Hem-Sba',         mdwNtr:null,    sigilSrc:'/images/senebty/sigils/hem-sba.png',         confidence:'none' },
    { key:'seba-en-seneb',   displayName:'Seba en Seneb',   mdwNtr:null,    sigilSrc:'/images/senebty/sigils/seba-en-seneb.png',   confidence:'none' },
    { key:'sesh-en-per-ankh',displayName:'Sesh en Per Ankh',mdwNtr:'𓊪𓏏𓎛',  confidence:'high' },
    { key:'wabau',           displayName:'Wabau',           mdwNtr:'𓄋𓎺',    confidence:'high' },
    { key:'sunu-sba',        displayName:'Sunu Sba',        mdwNtr:null,    sigilSrc:'/images/senebty/sigils/sunu-sba.png',        confidence:'none' },
    { key:'shemes-imhotep',  displayName:'Shemes Imhotep',  mdwNtr:null,    sigilSrc:'/images/senebty/sigils/shemes-imhotep.png',  confidence:'none' }
  ];
}

function buildApp(dom){
  const navCalls = [];
  const saveCalls = [];
  const app = {
    user: {
      senebty: {
        tier: 0,
        iriLog: [],
        iriCompletedByLesson: {},
        pendingParentConfirmations: [],
        streakDays: 0,
        lastRitualDate: null
      }
    },
    nav(screen, opts){ navCalls.push({ screen, opts }); },
    saveUser(){ saveCalls.push(Date.now()); }
  };
  app._iri = dom.window.Senebty.iri;
  dom.window.App = app;
  return { app, navCalls, saveCalls };
}

// Test 1: render.gate populates the tier badge sigil img.
{
  const dom = buildDom();
  installTiers(dom);
  loadModule(dom, 'senebty/lib/iri.js');
  loadModule(dom, 'senebty/lib/render.js');
  const { app } = buildApp(dom);
  dom.window.Senebty.render.gate(app);

  check('Test 1: tier glyph slot contains an <img> after render.gate(T0)', () => {
    const slot = dom.window.document.getElementById('senebtyTierGlyph');
    const img = slot.querySelector('img.senebty-tier-sigil');
    if (!img) throw new Error('no sigil img in tier glyph slot');
  });
  check('Test 1: sigil img has correct src for Hem-Sba', () => {
    const img = dom.window.document.querySelector('#senebtyTierGlyph img.senebty-tier-sigil');
    if (img.getAttribute('src') !== '/images/senebty/sigils/hem-sba.png') {
      throw new Error('src=' + img.getAttribute('src'));
    }
  });
  check('Test 1: sigil img has meaningful alt text (Tehuti binding)', () => {
    const img = dom.window.document.querySelector('#senebtyTierGlyph img.senebty-tier-sigil');
    const alt = img.getAttribute('alt');
    if (!alt || !alt.includes('Hem-Sba')) throw new Error('alt=' + JSON.stringify(alt));
    if (!alt.toLowerCase().includes('sigil')) throw new Error('alt missing "sigil": ' + alt);
  });
}

// Test 2: Foundations ring click → App.nav('senebtyFoundationsIndex').
// Regression for v3.35.0 `window.App = App` fix + v3.40.0 King-walkthrough
// binding (Foundations ring lands on the 8-Foundation index, not jumps
// straight into Foundation 1 / Mu).
{
  const dom = buildDom();
  installTiers(dom);
  loadModule(dom, 'senebty/lib/iri.js');
  loadModule(dom, 'senebty/lib/render.js');
  const { app, navCalls } = buildApp(dom);
  dom.window.Senebty.render.gate(app);

  check('Test 2: Foundations ring renders with data-ring="foundations"', () => {
    const ring = dom.window.document.querySelector('.senebty-ring[data-ring="foundations"]');
    if (!ring) throw new Error('Foundations ring not in #senebtyRings');
  });
  check('Test 2: clicking Foundations ring calls App.nav("senebtyFoundationsIndex")', () => {
    const ring = dom.window.document.querySelector('.senebty-ring[data-ring="foundations"]');
    ring.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    if (navCalls.length !== 1) throw new Error('nav call count=' + navCalls.length);
    if (navCalls[0].screen !== 'senebtyFoundationsIndex') throw new Error('nav screen=' + navCalls[0].screen);
  });
  check('Test 2: Foundations click does NOT open the ring modal', () => {
    const modal = dom.window.document.getElementById('senebtyRingModal');
    if (modal) throw new Error('modal opened — should have navigated instead');
  });
}

// Test 3: Locked ring click → modal with the ring's lockMsg.
{
  const dom = buildDom();
  installTiers(dom);
  loadModule(dom, 'senebty/lib/iri.js');
  loadModule(dom, 'senebty/lib/render.js');
  const { app, navCalls } = buildApp(dom);
  dom.window.Senebty.render.gate(app);

  check('Test 3: Rekh Domains ring has senebty-ring--locked class at T0', () => {
    const ring = dom.window.document.querySelector('.senebty-ring[data-ring="rekh"]');
    if (!ring) throw new Error('Rekh ring not rendered');
    if (!ring.classList.contains('senebty-ring--locked')) throw new Error('not marked locked');
  });
  check('Test 3: clicking locked Rekh ring opens modal with the ring lockMsg', () => {
    const ring = dom.window.document.querySelector('.senebty-ring[data-ring="rekh"]');
    ring.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    const modal = dom.window.document.getElementById('senebtyRingModal');
    if (!modal) throw new Error('locked-ring click did not open modal');
    const seba = modal.querySelector('.senebty-ring-modal__seba');
    if (!seba) throw new Error('modal missing seba paragraph');
    const text = seba.textContent;
    if (!text.includes('Sesh en Per Ankh')) throw new Error('lockMsg not present (got: ' + text + ')');
    if (navCalls.length !== 0) throw new Error('locked ring should not navigate');
  });
}

// Test 4: glossaryPanel open/close toggles is-open on panel + backdrop.
{
  const dom = buildDom();
  dom.window.Senebty = dom.window.Senebty || {};
  dom.window.Senebty.glossaryEntries = {};
  loadModule(dom, 'senebty/lib/glossary-panel.js');

  const panel = dom.window.document.getElementById('senebtyGlossaryPanel');
  const backdrop = dom.window.document.getElementById('senebtyGlossaryBackdrop');

  check('Test 4: panel + backdrop start without is-open class', () => {
    if (panel.classList.contains('is-open')) throw new Error('panel is-open before open()');
    if (backdrop.classList.contains('is-open')) throw new Error('backdrop is-open before open()');
  });
  check('Test 4: glossaryPanel.open() adds is-open to BOTH panel and backdrop', () => {
    dom.window.Senebty.glossaryPanel.open();
    if (!panel.classList.contains('is-open')) throw new Error('panel missing is-open after open()');
    if (!backdrop.classList.contains('is-open')) throw new Error('backdrop missing is-open after open()');
    if (panel.getAttribute('aria-hidden') !== 'false') throw new Error('panel aria-hidden not set to false');
  });
  check('Test 4: glossaryPanel.close() removes is-open from BOTH panel and backdrop', () => {
    dom.window.Senebty.glossaryPanel.close();
    if (panel.classList.contains('is-open')) throw new Error('panel still has is-open after close()');
    if (backdrop.classList.contains('is-open')) throw new Error('backdrop still has is-open after close()');
    if (panel.getAttribute('aria-hidden') !== 'true') throw new Error('panel aria-hidden not restored to true');
  });
}

// Test 5: foundation-mu.complete(app) records WATER_IRI without throw.
// Regression for v3.35.0 water-drink crash. Direct invocation
// (`app._iri.record(...)` without `.call(app)`) would throw
// "Cannot read 'TYPES' of undefined".
{
  const dom = buildDom();
  installTiers(dom);
  loadModule(dom, 'senebty/lib/iri.js');
  loadModule(dom, 'senebty/lib/foundation-mu.js');
  const { app, saveCalls } = buildApp(dom);

  check('Test 5: foundation-mu.complete(app) returns true on first call', () => {
    const result = dom.window.Senebty.foundationMu.complete(app);
    if (result !== true) throw new Error('expected true, got ' + result);
  });
  check('Test 5: complete() records a WATER_IRI in user.senebty.iriLog', () => {
    const log = app.user.senebty.iriLog;
    if (log.length !== 1) throw new Error('iriLog length=' + log.length);
    if (log[0].type !== 'WATER_IRI') throw new Error('record type=' + log[0].type);
    if (log[0].lessonId !== 'foundation-1') throw new Error('lessonId=' + log[0].lessonId);
  });
  check('Test 5: complete() called saveUser', () => {
    if (saveCalls.length < 1) throw new Error('saveUser not invoked');
  });
  check('Test 5: complete() second call same day returns false (idempotent)', () => {
    const result = dom.window.Senebty.foundationMu.complete(app);
    if (result !== false) throw new Error('expected false on second same-day call');
  });
}

console.log(`\n${PASS}/${PASS+FAIL} passed`);
process.exit(FAIL === 0 ? 0 : 1);
