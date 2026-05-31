// tests/senebty-streak-pause.test.mjs
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const src = fs.readFileSync('senebty/lib/streak-pause.js', 'utf8');
const dom = new JSDOM('<!doctype html><html><body><div id="senebtyParentCard"></div></body></html>');
const { window } = dom;
window.Senebty = window.Senebty || {};
new window.Function('window', src)(window);

function buildUser(overrides){
  return {
    senebty: {
      streakDays: 5,
      streakPause: { active:false, startedAt:null, endsAt:null, daysUsedThisMonth:0, monthCounterResetAt:null },
      ...overrides,
    },
    saveUser(){},
  };
}

check('window.Senebty.streakPause.openModal exists', () => {
  assert.equal(typeof window.Senebty.streakPause.openModal, 'function');
});

check('Modal renders with first-focus on Cancel', () => {
  window.App = { user: buildUser(), saveUser(){} };
  window.Senebty.streakPause.openModal();
  const cancelBtn = window.document.querySelector('.senebty-streak-pause-modal__cancel');
  const confirmBtn = window.document.querySelector('.senebty-streak-pause-modal__confirm');
  assert.ok(cancelBtn && confirmBtn);
  assert.equal(window.document.activeElement, cancelBtn);
  window.document.querySelector('.senebty-streak-pause-modal-overlay').remove();
});

check('Confirm sets streakPause active with future dates', () => {
  window.App = { user: buildUser(), saveUser(){} };
  window.Senebty.streakPause.openModal();
  const dayInput = window.document.querySelector('input[name="senebty-streak-pause-days"][value="2"]');
  dayInput.checked = true;
  window.document.querySelector('.senebty-streak-pause-modal__confirm').click();
  const sp = window.App.user.senebty.streakPause;
  assert.equal(sp.active, true);
  assert.ok(sp.startedAt);
  assert.ok(sp.endsAt);
  assert.equal(sp.daysUsedThisMonth, 2);
});

check('Cap at 3 days', () => {
  window.App = { user: buildUser({ streakPause: { active:false, startedAt:null, endsAt:null, daysUsedThisMonth:1, monthCounterResetAt:null }}), saveUser(){} };
  window.Senebty.streakPause.openModal();
  const day3 = window.document.querySelector('input[name="senebty-streak-pause-days"][value="3"]');
  assert.ok(!day3 || day3.disabled);
  window.document.querySelector('.senebty-streak-pause-modal-overlay').remove();
});

check('Calendar-month rollover resets counter', () => {
  window.App = { user: buildUser({ streakPause: { active:false, startedAt:null, endsAt:null, daysUsedThisMonth:3, monthCounterResetAt:'2026-04' }}), saveUser(){} };
  window.Senebty.streakPause.maybeResetMonthlyCounter(new Date('2026-05-04'));
  assert.equal(window.App.user.senebty.streakPause.daysUsedThisMonth, 0);
  assert.equal(window.App.user.senebty.streakPause.monthCounterResetAt, '2026-05');
});

check('Pause history panel renders past pauses', () => {
  window.App = { user: { ...buildUser(), streakPauseHistory: [
    { startedAt:'2026-04-10', endsAt:'2026-04-12', days:3 },
  ]}, saveUser(){} };
  const host = window.document.getElementById('senebtyParentCard');
  window.Senebty.streakPause.renderHistoryPanel(host);
  assert.match(host.textContent, /Pause history/);
  assert.match(host.textContent, /2026-04-10/);
});

check('ESC dismisses modal', () => {
  window.App = { user: buildUser(), saveUser(){} };
  window.Senebty.streakPause.openModal();
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Escape' }));
  assert.equal(window.document.querySelector('.senebty-streak-pause-modal-overlay'), null);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
