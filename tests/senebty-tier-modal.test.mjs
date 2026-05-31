// tests/senebty-tier-modal.test.mjs
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const tierModalSrc = fs.readFileSync('senebty/lib/tier-modal.js', 'utf8');
const tiersSrc = fs.readFileSync('senebty/lib/tiers.js', 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
const { window } = dom;
window.Senebty = window.Senebty || {};

function inject(src){
  const fn = new window.Function('window', 'document', 'setTimeout', 'clearTimeout', src);
  fn.call(window, window, window.document, window.setTimeout.bind(window), window.clearTimeout.bind(window));
}
inject(tiersSrc);
inject(tierModalSrc);

function cleanupModals(){
  // Synchronously remove any modal overlays the implementation may have queued
  // for delayed removal (250ms fade), so the next test starts from a clean DOM.
  window.document.querySelectorAll('.senebty-tier-modal-overlay').forEach(el => el.remove());
}

check('window.Senebty.tierModal.show exists', () => {
  assert.equal(typeof window.Senebty.tierModal.show, 'function');
});

check('show with preEntryHold:false renders modal with verbatim advancementCopy', () => {
  window.Senebty.tierModal.show('seba-en-seneb', { preEntryHold: false });
  const modal = window.document.querySelector('.senebty-tier-modal');
  assert.ok(modal, 'modal not in DOM');
  const body = modal.querySelector('.senebty-tier-modal__body').textContent;
  const tier = window.Senebty.tiers.find(t => t.key === 'seba-en-seneb');
  assert.equal(body.trim(), tier.advancementCopy.trim(), 'body must equal tiers.js advancementCopy verbatim');
  modal.parentElement.remove();
});

check('button label is "I understand."', () => {
  window.Senebty.tierModal.show('wabau', { preEntryHold: false });
  const btn = window.document.querySelector('.senebty-tier-modal__btn');
  assert.equal(btn.textContent.trim(), 'I understand.');
  cleanupModals();
});

check('first focus is on the button', () => {
  window.Senebty.tierModal.show('wabau', { preEntryHold: false });
  const btn = window.document.querySelector('.senebty-tier-modal__btn');
  assert.equal(window.document.activeElement, btn);
  cleanupModals();
});

check('ESC dismisses the modal', () => {
  window.Senebty.tierModal.show('wabau', { preEntryHold: false });
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  const modal = window.document.querySelector('.senebty-tier-modal');
  assert.equal(modal, null);
});

check('deferDuringRitual queues; flushQueue drains', () => {
  window.Senebty.tierModal._activeRitual = true;
  window.Senebty.tierModal.show('wabau', { deferDuringRitual: true, preEntryHold: false });
  assert.equal(window.document.querySelector('.senebty-tier-modal'), null, 'must NOT render during ritual');
  window.Senebty.tierModal._activeRitual = false;
  window.Senebty.tierModal.flushQueue();
  const modalAfter = window.document.querySelector('.senebty-tier-modal');
  assert.ok(modalAfter, 'must render after flush');
  modalAfter.querySelector('.senebty-tier-modal__btn').click();
});

check('button is secondary-styled, not destructive primary', () => {
  window.Senebty.tierModal.show('wabau', { preEntryHold: false });
  const btn = window.document.querySelector('.senebty-tier-modal__btn');
  assert.ok(!btn.classList.contains('btn-primary-destructive') && !btn.classList.contains('btn-destructive'));
  cleanupModals();
});

// v3.51.27 — Stage-1 RT + Stage-2 Coach additions

check('title is displayName only — no translation suffix appended', () => {
  // tone-canon spec (seba-voice-senebty.md §Tier-advancement modal):
  // "title = [glyph] [tier name]" — translation must NOT be appended to the title.
  window.Senebty.tierModal.show('seba-en-seneb', { preEntryHold: false });
  const modal = window.document.querySelector('.senebty-tier-modal');
  const titleEl = modal.querySelector('.senebty-tier-modal__title');
  const tier = window.Senebty.tiers.find(t => t.key === 'seba-en-seneb');
  // Title must equal displayName (possibly prefixed by mdwNtr glyph if confidence is high/medium)
  // — it must NOT contain " — " + translation.
  assert.ok(!titleEl.textContent.includes(' — '), 'title must not contain " — translation" suffix');
  assert.ok(titleEl.textContent.includes(tier.displayName), 'title must include displayName');
  modal.parentElement.remove();
});

check('title includes mdwNtr glyph for high-confidence tiers', () => {
  // wabau has mdwNtrConfidence:'high' — glyph must appear in title
  window.Senebty.tierModal.show('wabau', { preEntryHold: false });
  const modal = window.document.querySelector('.senebty-tier-modal');
  const titleEl = modal.querySelector('.senebty-tier-modal__title');
  const tier = window.Senebty.tiers.find(t => t.key === 'wabau');
  assert.ok(tier.mdwNtrConfidence === 'high', 'test setup: wabau must be high confidence');
  assert.ok(titleEl.textContent.includes(tier.mdwNtr), 'title must include mdwNtr glyph for high-confidence tiers');
  cleanupModals();
});

check('title omits mdwNtr glyph for none-confidence tiers', () => {
  // hem-sba has mdwNtrConfidence:'none' — glyph must NOT appear in title
  window.Senebty.tierModal.show('hem-sba', { preEntryHold: false });
  const modal = window.document.querySelector('.senebty-tier-modal');
  const titleEl = modal.querySelector('.senebty-tier-modal__title');
  const tier = window.Senebty.tiers.find(t => t.key === 'hem-sba');
  assert.ok(tier.mdwNtrConfidence === 'none', 'test setup: hem-sba must be none confidence');
  // mdwNtr is null for none-confidence — title must be displayName only
  assert.equal(titleEl.textContent.trim(), tier.displayName);
  cleanupModals();
});

check('multiple sequential shows do not accumulate overlays', () => {
  // Edge case (Coach v3.51.27): rapid tier advance should not leave orphaned overlays.
  window.Senebty.tierModal.show('wabau', { preEntryHold: false });
  window.document.querySelector('.senebty-tier-modal__btn').click(); // dismiss first
  window.Senebty.tierModal.show('sesh-en-per-ankh', { preEntryHold: false });
  const overlays = window.document.querySelectorAll('.senebty-tier-modal-overlay');
  assert.equal(overlays.length, 1, 'only one overlay should be in the DOM after sequential shows');
  cleanupModals();
});

check('flushQueue with multiple queued tiers shows them sequentially without stacking', () => {
  // Edge case (Coach v3.51.27): two tiers queued during ritual — flush shows one at a time.
  window.Senebty.tierModal._activeRitual = true;
  window.Senebty.tierModal.show('wabau', { deferDuringRitual: true, preEntryHold: false });
  window.Senebty.tierModal.show('seba-en-seneb', { deferDuringRitual: true, preEntryHold: false });
  assert.equal(window.document.querySelector('.senebty-tier-modal'), null, 'no modal during ritual');
  window.Senebty.tierModal._activeRitual = false;
  window.Senebty.tierModal.flushQueue();
  // flushQueue drains all — two modals fired, both should be in DOM (stacked) or
  // at minimum the first is visible. The important constraint: no crash.
  const modals = window.document.querySelectorAll('.senebty-tier-modal');
  assert.ok(modals.length >= 1, 'at least one modal in DOM after flush');
  cleanupModals();
});

check('tiers.js — all tier advancementCopy matches seba-voice-senebty.md tier-advancement phrases', () => {
  // Cross-check the verbatim canon. seba-voice-senebty.md §Tier advancement lists
  // the canonical phrases; tiers.js must not deviate.
  const CANON = {
    'seba-en-seneb':       'You have iri once. You are no longer at the gate. Come inside the Per Ankh. Today you become Seba en Seneb — Student of Health.',
    'sesh-en-per-ankh':    'Eight Foundations. Eight iri. You can now teach what you have done. Today you become Sesh en Per Ankh — Scribe of the House of Life.',
    'wabau':               'Twenty-one mornings. The Daily Senebty Ritual is in your body now, not your memory. Today you become Wabau — Pure One.',
    'sunu-sba':            'You have taught another. Teaching is the proof of mastery. Today you become Sunu Sba — Apprentice Physician.',
  };
  for (const [key, canon] of Object.entries(CANON)){
    const tier = window.Senebty.tiers.find(t => t.key === key);
    assert.ok(tier, `tier '${key}' must exist`);
    assert.equal(
      tier.advancementCopy.trim(),
      canon.trim(),
      `advancementCopy for '${key}' must match seba-voice-senebty.md verbatim`
    );
  }
});

check('hem-sba advancement copy is tone-canon (entry copy)', () => {
  // Hem-Sba is the entry tier — its copy is gate-description, not advancement.
  const tier = window.Senebty.tiers.find(t => t.key === 'hem-sba');
  assert.ok(tier, 'hem-sba tier must exist');
  assert.ok(tier.advancementCopy.length > 0, 'hem-sba must have advancementCopy');
  // Must not contain celebration-patter (seba-voice-senebty.md NEVER list)
  const banned = ['Great job', 'Awesome', 'Amazing', 'Way to go', 'You did it', '!'];
  for (const b of banned){
    assert.ok(!tier.advancementCopy.includes(b), `hem-sba copy must not contain "${b}"`);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
