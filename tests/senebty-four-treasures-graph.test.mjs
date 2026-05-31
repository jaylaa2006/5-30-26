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
const css = fs.readFileSync('senebty/styles/senebty.css', 'utf8');

const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>');
const { window } = dom;
window.Senebty = window.Senebty || {};
new window.Function('window', tiersSrc)(window);
new window.Function('window', dashSrc)(window);

function buildLog(days){
  const log = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400 * 1000).toISOString().slice(0, 10);
    log.push({ date: d, khat: 'holding', ib: 'strong', ka: 'holding', ba: 'weak' });
  }
  return log;
}
function clearHost(){
  const host = window.document.getElementById('host');
  while (host.firstChild) host.removeChild(host.firstChild);
  return host;
}

check('renderFourTreasuresGraph exposed', () => {
  assert.equal(typeof window.Senebty.parentDashboard.renderFourTreasuresGraph, 'function');
});

check('Empty state renders placeholder text (no canvas)', () => {
  const host = clearHost();
  window.Senebty.parentDashboard.renderFourTreasuresGraph(host, []);
  assert.equal(host.querySelector('canvas'), null);
  assert.match(host.textContent, /Sweet things take time|Keep walking the path/);
});

check('Canvas renders with non-empty log', () => {
  const host = clearHost();
  window.Senebty.parentDashboard.renderFourTreasuresGraph(host, buildLog(30));
  assert.ok(host.querySelector('canvas'));
});

check('aria-label trend summary present (mentions all 4 treasures)', () => {
  const host = clearHost();
  window.Senebty.parentDashboard.renderFourTreasuresGraph(host, buildLog(7));
  const c = host.querySelector('canvas');
  const ariaLabel = c.getAttribute('aria-label') || '';
  assert.match(ariaLabel, /Khat/);
  assert.match(ariaLabel, /Ib/);
  assert.match(ariaLabel, /Ka/);
  assert.match(ariaLabel, /Ba/);
});

check('Text-table toggle button present and functional', () => {
  const host = clearHost();
  window.Senebty.parentDashboard.renderFourTreasuresGraph(host, buildLog(7));
  const toggleBtn = host.querySelector('button');
  assert.ok(toggleBtn);
  assert.match(toggleBtn.textContent, /View as numbers|View as graph/);
  toggleBtn.click();
  assert.ok(host.querySelector('table'));
});

check('CSS includes prefers-reduced-motion handling', () => {
  assert.match(css, /senebty-four-treasures-graph/);
  assert.match(css, /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
});

check('CSS includes prefers-contrast handling', () => {
  assert.match(css, /@media\s*\(\s*prefers-contrast:\s*(more|high)\s*\)/);
});

check('Value mapping function exposed: weak=1, holding=2, strong=3', () => {
  const host = clearHost();
  window.Senebty.parentDashboard.renderFourTreasuresGraph(host, [{
    date: new Date().toISOString().slice(0,10),
    khat: 'weak', ib: 'holding', ka: 'strong', ba: 'weak'
  }]);
  host.querySelector('button').click();
  const tableText = host.querySelector('table').textContent;
  assert.match(tableText, /1/);
  assert.match(tableText, /2/);
  assert.match(tableText, /3/);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
