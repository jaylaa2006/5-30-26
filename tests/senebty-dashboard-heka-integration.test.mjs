import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const tiersSrc = fs.readFileSync('senebty/lib/tiers.js', 'utf8');
const hekaSrc = fs.readFileSync('senebty/lib/heka-phrase.js', 'utf8');
const dashSrc = fs.readFileSync('senebty/lib/parent-dashboard.js', 'utf8');

const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>');
const { window } = dom;
window.Senebty = window.Senebty || {};
new window.Function('window', tiersSrc)(window);
new window.Function('window', hekaSrc)(window);
new window.Function('window', dashSrc)(window);

function clearHost(host){ while (host.firstChild) host.removeChild(host.firstChild); }

function buildUser(hekaPhrase, hekaSetAt){
  return {
    id: 'u-test', name: 'Khaemwaset',
    senebty: { tier: 1, iriLog: [], iriCompletedByLesson: {},
      hekaPhrasePersonal: hekaPhrase || null,
      hekaPhraseSetAt: hekaSetAt || null,
    },
  };
}

check('renderHekaSection exposed', () => {
  assert.equal(typeof window.Senebty.parentDashboard.renderHekaSection, 'function');
});

check('Unset state mentions Foundation 8', () => {
  const host = window.document.getElementById('host');
  clearHost(host);
  window.Senebty.parentDashboard.renderHekaSection(host, buildUser());
  assert.match(host.textContent, /not yet composed|Foundation 8/);
});

check('Set state renders phrase + child name + Delete button', () => {
  const host = window.document.getElementById('host');
  clearHost(host);
  window.Senebty.parentDashboard.renderHekaSection(host, buildUser('Maat is breath I carry.', 1700000000000));
  assert.match(host.textContent, /Maat is breath I carry/);
  assert.match(host.textContent, /Khaemwaset/);
  const btn = host.querySelector('button');
  assert.ok(btn && /delete/i.test(btn.textContent));
});

check('renderSenebtyCard wires Heka section into the host', () => {
  const host = window.document.getElementById('host');
  clearHost(host);
  window.App = { user: buildUser('X', 1700000000000) };
  window.Senebty.parentDashboard.renderSenebtyCard(host, window.App.user);
  const hekaHost = host.querySelector('#senebtyParentHekaHost');
  assert.ok(hekaHost);
  assert.match(hekaHost.textContent, /Khaemwaset/);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
