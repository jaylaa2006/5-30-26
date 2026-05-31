import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const tiersSrc = fs.readFileSync('senebty/lib/tiers.js', 'utf8');
const dashSrc = fs.readFileSync('senebty/lib/parent-dashboard.js', 'utf8');

const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>');
const { window } = dom;
window.Senebty = window.Senebty || {};
new window.Function('window', tiersSrc)(window);
new window.Function('window', dashSrc)(window);

function buildUser(overrides){
  return {
    name: 'Test',
    senebty: {
      tier: 1,
      iriLog: [{ timestamp: Date.now(), lessonId: 'foundation-1' }],
      iriCompletedByLesson: { 'foundation-1': {} },
      ...overrides,
    },
  };
}
function clearHost(){
  const host = window.document.getElementById('host');
  while (host.firstChild) host.removeChild(host.firstChild);
  return host;
}

check('window.Senebty.parentDashboard.renderSenebtyCard exists', () => {
  assert.equal(typeof window.Senebty.parentDashboard.renderSenebtyCard, 'function');
});

check('Senebty card renders title', () => {
  const host = clearHost();
  window.Senebty.parentDashboard.renderSenebtyCard(host, buildUser());
  assert.match(host.textContent, /Senebty/);
  assert.match(host.textContent, /Path of Health/);
});

check('Tier name rendered', () => {
  const host = clearHost();
  window.Senebty.parentDashboard.renderSenebtyCard(host, buildUser({ tier: 1 }));
  assert.match(host.textContent, /Seba en Seneb/);
});

check('Iri tally is factual count, no praise', () => {
  const host = clearHost();
  window.Senebty.parentDashboard.renderSenebtyCard(host, buildUser());
  assert.match(host.textContent, /Iri completed this week:\s*\d+/);
  assert.doesNotMatch(host.textContent, /(great job|amazing|awesome)/i);
});

check('Tier-progress role=progressbar with aria-valuetext', () => {
  const host = clearHost();
  window.Senebty.parentDashboard.renderSenebtyCard(host, buildUser({ tier: 1 }));
  const bar = host.querySelector('[role="progressbar"]');
  assert.ok(bar);
  assert.ok(bar.getAttribute('aria-valuetext'));
});

check('Sesh tier copy honestly mentions F5 deferral (parent-side, Cultural Consensus)', () => {
  const host = clearHost();
  window.Senebty.parentDashboard.renderSenebtyCard(host, buildUser({ tier: 1 }));
  assert.match(host.textContent, /Foundation 5/);
  assert.match(host.textContent, /Wedeha is being prepared/);
});

check('All 5 host divs present (graph, streak-pause, heka, pending, auto-advance)', () => {
  const host = clearHost();
  window.Senebty.parentDashboard.renderSenebtyCard(host, buildUser());
  assert.ok(host.querySelector('#senebtyParentGraphHost'));
  assert.ok(host.querySelector('#senebtyParentStreakPauseHost'));
  assert.ok(host.querySelector('#senebtyParentHekaHost'));
  assert.ok(host.querySelector('#senebtyParentPendingHost'));
  assert.ok(host.querySelector('#senebtyParentAutoAdvanceHost'));
});

check('Tone canon NEVER words absent', () => {
  const host = clearHost();
  window.Senebty.parentDashboard.renderSenebtyCard(host, buildUser());
  const html = host.outerHTML;
  assert.doesNotMatch(html, /(great job|amazing|awesome|way to go|you did it|keep going)/i);
});

// ─── v3.51.66 — daily-ritual opt-out toggle ───
check('renderDailyRitualToggle is exported', () => {
  assert.equal(typeof window.Senebty.parentDashboard.renderDailyRitualToggle, 'function');
});

check('Daily-ritual toggle renders default ON (checked when preference unset)', () => {
  const host = clearHost();
  window.Senebty.parentDashboard.renderSenebtyCard(host, buildUser());
  const cb = host.querySelector('.senebty-daily-ritual-toggle-input');
  assert.ok(cb, 'toggle checkbox must render in the Senebty card');
  assert.equal(cb.checked, true, 'default ON → checked when preference unset');
  assert.match(host.textContent, /Daily Ritual for/);
});

check('Daily-ritual toggle reflects preference === false (unchecked)', () => {
  const host = clearHost();
  const u = buildUser();
  u.preferences = { senebtyDailyRitual: false };
  window.Senebty.parentDashboard.renderSenebtyCard(host, u);
  const cb = host.querySelector('.senebty-daily-ritual-toggle-input');
  assert.equal(cb.checked, false, 'preference false → unchecked');
});

check('Daily-ritual toggle writes preference + persists via App.saveUser on change', () => {
  const host = clearHost();
  const u = buildUser();
  let saved = 0;
  window.App = { saveUser: () => { saved++; } };
  window.Senebty.parentDashboard.renderSenebtyCard(host, u);
  const cb = host.querySelector('.senebty-daily-ritual-toggle-input');
  cb.checked = false;
  cb.dispatchEvent(new window.Event('change'));
  assert.equal(u.preferences.senebtyDailyRitual, false, 'unchecking sets preference false (opt out)');
  assert.equal(saved, 1, 'must persist via App.saveUser');
  cb.checked = true;
  cb.dispatchEvent(new window.Event('change'));
  assert.equal(u.preferences.senebtyDailyRitual, true, 'checking sets preference true (opt back in)');
  assert.equal(saved, 2, 'must persist again');
  delete window.App;
});

check('Daily-ritual toggle has explicit label-for association (a11y)', () => {
  const host = clearHost();
  window.Senebty.parentDashboard.renderSenebtyCard(host, buildUser());
  const cb = host.querySelector('.senebty-daily-ritual-toggle-input');
  const label = host.querySelector('.senebty-daily-ritual-toggle-label');
  assert.ok(cb.id, 'checkbox must have an id');
  assert.equal(label.getAttribute('for'), cb.id, 'label[for] must match checkbox id');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
