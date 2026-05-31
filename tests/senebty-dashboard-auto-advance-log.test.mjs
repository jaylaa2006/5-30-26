import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
async function check(name, fn){
  try { await fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const tiersSrc = fs.readFileSync('senebty/lib/tiers.js', 'utf8');
const dashSrc = fs.readFileSync('senebty/lib/parent-dashboard.js', 'utf8');

const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>');
const { window } = dom;
window.Senebty = window.Senebty || {};
new window.Function('window', tiersSrc)(window);
new window.Function('window', dashSrc)(window);

function clearHost(host){ while (host.firstChild) host.removeChild(host.firstChild); }

function mockFetch(rows){
  return async () => ({ ok: true, json: async () => ({ pending: rows }) });
}

await check('renderAutoAdvanceLogSection exposed', () => {
  assert.equal(typeof window.Senebty.parentDashboard.renderAutoAdvanceLogSection, 'function');
});

await check('Auto-advanced row renders tone-canon copy', async () => {
  const host = window.document.getElementById('host');
  clearHost(host);
  await window.Senebty.parentDashboard.renderAutoAdvanceLogSection(host, { senebty: {} }, {
    fetch: mockFetch([{
      id: 1, lesson_id: 'foundation-8-heka', evidence_text: 'X',
      submitted_at: Date.now() - 14 * 86400 * 1000, status: 'auto_advanced',
      days_pending: 14, confirm_token: 'tok',
    }])
  });
  assert.match(host.textContent, /Auto-confirmed after 14 days/);
  assert.match(host.textContent, /The path moved on/);
});

await check('Empty state renders nothing (no placeholder)', async () => {
  const host = window.document.getElementById('host');
  clearHost(host);
  await window.Senebty.parentDashboard.renderAutoAdvanceLogSection(host, { senebty: {} }, { fetch: mockFetch([]) });
  // No content rendered when no auto-advances
  assert.equal(host.textContent.trim(), '');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
