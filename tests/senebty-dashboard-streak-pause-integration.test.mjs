import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const tiersSrc = fs.readFileSync('senebty/lib/tiers.js', 'utf8');
const streakPauseSrc = fs.readFileSync('senebty/lib/streak-pause.js', 'utf8');
const dashSrc = fs.readFileSync('senebty/lib/parent-dashboard.js', 'utf8');

const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>');
const { window } = dom;
window.Senebty = window.Senebty || {};
new window.Function('window', tiersSrc)(window);
new window.Function('window', streakPauseSrc)(window);
new window.Function('window', dashSrc)(window);

function clearHost(host){ while (host.firstChild) host.removeChild(host.firstChild); }

function buildUser(streakPause){
  return {
    name: 'Test',
    senebty: {
      tier: 1,
      iriLog: [],
      iriCompletedByLesson: {},
      streakDays: 5,
      streakPause: streakPause || { active:false, startedAt:null, endsAt:null, daysUsedThisMonth:0, monthCounterResetAt:null },
    },
  };
}

check('renderStreakPauseSection exposed', () => {
  assert.equal(typeof window.Senebty.parentDashboard.renderStreakPauseSection, 'function');
});

check('Inactive state renders streakDays + Pause button', () => {
  const host = window.document.getElementById('host');
  clearHost(host);
  window.Senebty.parentDashboard.renderStreakPauseSection(host, buildUser());
  assert.match(host.textContent, /5\s+days|Streak/);
  assert.ok(host.querySelector('button'));
});

check('Active pause renders "Paused" copy with N of 3 used', () => {
  const host = window.document.getElementById('host');
  clearHost(host);
  window.Senebty.parentDashboard.renderStreakPauseSection(host, buildUser({
    active: true, startedAt: '2026-05-10', endsAt: '2026-05-12', daysUsedThisMonth: 2, monthCounterResetAt: '2026-05'
  }));
  assert.match(host.textContent, /Paused/);
  assert.match(host.textContent, /2\s+of\s+3/i);
});

check('renderSenebtyCard wires streak-pause section into the host', () => {
  const host = window.document.getElementById('host');
  clearHost(host);
  window.App = { user: buildUser() };  // streakPause module reads window.App.user
  window.Senebty.parentDashboard.renderSenebtyCard(host, window.App.user);
  const streakHost = host.querySelector('#senebtyParentStreakPauseHost');
  assert.ok(streakHost);
  assert.ok(streakHost.querySelector('button'));  // Pause button populated
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
