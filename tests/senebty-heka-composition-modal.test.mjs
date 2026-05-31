#!/usr/bin/env node
// M4 Task 10 regression — Heka phrase composition modal at F8 iri-completion.
// The window.prompt() shim was inappropriate for child-facing UX; this test
// locks the styled modal contract: open, type, save → set() invoked.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

let dom;
before(() => {
  // Stub window.Senebty + window.App before bridge-mode/heka-phrase load.
  const tiersStub = `window.Senebty = { tiers: [] };
    window.App = {
      user: { id: 'test-user', name: 'King', senebty: { tier: 4, hekaPhrasePersonal: null } },
      saveUser: function(){ window.App._savedAt = Date.now(); }
    };`;
  const src = fs.readFileSync(path.join(process.cwd(), 'senebty/lib/heka-phrase.js'), 'utf8');
  dom = new JSDOM(
    `<!doctype html><html><body>
       <script>${tiersStub}</script>
       <script>${src}</script>
     </body></html>`,
    { url: 'http://localhost/', runScripts: 'dangerously' }
  );
});

test('Senebty.hekaPhrase.openComposeModal is exposed', () => {
  assert.equal(typeof dom.window.Senebty.hekaPhrase.openComposeModal, 'function');
});

test('openComposeModal renders an overlay with textarea + Save + Cancel', () => {
  const overlay = dom.window.Senebty.hekaPhrase.openComposeModal({ childName: 'King' });
  assert.ok(overlay, 'returns the overlay element');
  const ta = overlay.querySelector('textarea');
  assert.ok(ta, 'textarea present');
  const save = overlay.querySelector('.senebty-heka-compose-save');
  const cancel = overlay.querySelector('.senebty-heka-compose-cancel');
  assert.ok(save, 'Save button present');
  assert.ok(cancel, 'Cancel button present');
  // Save is disabled until min length entered
  assert.equal(save.disabled, true, 'Save initially disabled');
  // Tone-canon copy includes the child name
  const intro = overlay.querySelector('.senebty-heka-compose-intro');
  assert.match(intro.textContent, /King/);
  assert.match(intro.textContent, /One sentence/);
  overlay.remove();
});

test('Save button calls hekaPhrase.set with entered phrase, then dismisses', () => {
  // Reset state
  dom.window.App.user.senebty.hekaPhrasePersonal = null;
  const overlay = dom.window.Senebty.hekaPhrase.openComposeModal({ childName: 'King' });
  const ta = overlay.querySelector('textarea');
  const save = overlay.querySelector('.senebty-heka-compose-save');
  ta.value = 'My word makes my house strong';
  ta.dispatchEvent(new dom.window.Event('input'));
  assert.equal(save.disabled, false, 'Save enabled after sufficient text');
  save.click();
  // Phrase set on user
  assert.equal(dom.window.App.user.senebty.hekaPhrasePersonal, 'My word makes my house strong');
  // saveUser invoked
  assert.ok(dom.window.App._savedAt, 'App.saveUser called');
  // Overlay dismissed
  assert.equal(dom.window.document.querySelectorAll('.senebty-heka-compose-overlay').length, 0);
});

test('Cancel button does NOT set phrase, dismisses cleanly', () => {
  dom.window.App.user.senebty.hekaPhrasePersonal = 'previous';
  const overlay = dom.window.Senebty.hekaPhrase.openComposeModal({ childName: 'King' });
  const ta = overlay.querySelector('textarea');
  const cancel = overlay.querySelector('.senebty-heka-compose-cancel');
  ta.value = 'new phrase that should not save';
  ta.dispatchEvent(new dom.window.Event('input'));
  cancel.click();
  // Phrase NOT changed
  assert.equal(dom.window.App.user.senebty.hekaPhrasePersonal, 'previous');
  // Overlay gone
  assert.equal(dom.window.document.querySelectorAll('.senebty-heka-compose-overlay').length, 0);
});

test('ESC dismisses + cleans up document keydown listener', () => {
  const overlay = dom.window.Senebty.hekaPhrase.openComposeModal({ childName: 'King' });
  assert.ok(overlay._escHandler, 'escHandler bound');
  const ev = new dom.window.KeyboardEvent('keydown', { key: 'Escape' });
  dom.window.document.dispatchEvent(ev);
  assert.equal(dom.window.document.querySelectorAll('.senebty-heka-compose-overlay').length, 0);
  // Re-dispatch — should not throw (handler removed)
  dom.window.document.dispatchEvent(ev);
});

test('focus-trap: Tab on Save (last) wraps to textarea (first)', () => {
  // Set phrase so Save is enabled (else it's excluded from focusable selector)
  const overlay = dom.window.Senebty.hekaPhrase.openComposeModal({ childName: 'King' });
  const ta = overlay.querySelector('textarea');
  ta.value = 'enable save';
  ta.dispatchEvent(new dom.window.Event('input'));
  const save = overlay.querySelector('.senebty-heka-compose-save');
  save.focus();
  const tabEv = new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
  overlay.dispatchEvent(tabEv);
  assert.equal(dom.window.document.activeElement, ta, 'Tab from last wraps to textarea');
  overlay.remove();
});
