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
  return async (url) => ({
    ok: true,
    json: async () => ({ pending: rows }),
  });
}

const sampleRow = {
  id: 1, lesson_id: 'foundation-8-heka', evidence_text: 'Taught SENEB to mom.',
  submitted_at: Date.now() - 86400000, status: 'pending', days_pending: 1,
  confirm_token: 'tok-abc',
};

await check('renderPendingConfirmsSection exposed', () => {
  assert.equal(typeof window.Senebty.parentDashboard.renderPendingConfirmsSection, 'function');
});

await check('Empty state copy renders', async () => {
  const host = window.document.getElementById('host');
  clearHost(host);
  await window.Senebty.parentDashboard.renderPendingConfirmsSection(host, { senebty: {} }, { fetch: mockFetch([]) });
  assert.match(host.textContent, /Nothing awaiting your eye/);
});

await check('Pending row renders with tone-canon copy', async () => {
  const host = window.document.getElementById('host');
  clearHost(host);
  await window.Senebty.parentDashboard.renderPendingConfirmsSection(host, { name: 'Test', senebty: {} }, { fetch: mockFetch([sampleRow]) });
  assert.match(host.textContent, /reports iri on Foundation/);
  assert.match(host.textContent, /at least 8 words/);
  assert.doesNotMatch(host.textContent, /(great job|amazing|awesome)/i);
});

await check('Confirm button disabled until ≥8 words', async () => {
  const host = window.document.getElementById('host');
  clearHost(host);
  await window.Senebty.parentDashboard.renderPendingConfirmsSection(host, { name: 'Test', senebty: {} }, { fetch: mockFetch([sampleRow]) });
  const textarea = host.querySelector('textarea');
  const btn = host.querySelector('button');
  assert.ok(textarea && btn);
  // 5 words → disabled
  textarea.value = 'one two three four five';
  textarea.dispatchEvent(new window.Event('input'));
  assert.ok(btn.disabled);
  // 9 words → enabled
  textarea.value = 'one two three four five six seven eight nine';
  textarea.dispatchEvent(new window.Event('input'));
  assert.ok(!btn.disabled);
});

await check('Confirm POSTs to correct endpoint and removes row on success', async () => {
  const host = window.document.getElementById('host');
  clearHost(host);
  let confirmCalledWith = null;
  const mockFetchWithConfirm = async (url, opts) => {
    if (url.startsWith('/api/senebty/teaching-iri/pending')) {
      return { ok: true, json: async () => ({ pending: [sampleRow] }) };
    }
    if (url.includes('/api/senebty/teaching-iri/confirm')) {
      confirmCalledWith = { url, opts };
      return { ok: true, text: async () => 'ok' };
    }
    return { ok: false };
  };
  await window.Senebty.parentDashboard.renderPendingConfirmsSection(host, { name: 'Test', senebty: {} }, { fetch: mockFetchWithConfirm });
  const textarea = host.querySelector('textarea');
  const btn = host.querySelector('button');
  textarea.value = 'one two three four five six seven eight nine';
  textarea.dispatchEvent(new window.Event('input'));
  btn.click();
  // wait for async fetch to resolve
  await new Promise(r => setTimeout(r, 30));
  assert.ok(confirmCalledWith && confirmCalledWith.url.includes('token=tok-abc'));
  // After success, row should be gone
  assert.equal(host.querySelector('textarea'), null);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
