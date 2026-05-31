// tests/senebty-trials-stub.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const html = fs.readFileSync('maat-reader.html', 'utf8');
const css = fs.readFileSync('senebty/styles/senebty.css', 'utf8');

check('#imhotepTrials screen present', () => {
  assert.match(html, /<div id="imhotepTrials"[^>]*class="screen"/);
});

check('Saqqara cited in screen block', () => {
  const idx = html.indexOf('id="imhotepTrials"');
  const slice = html.slice(idx, idx + 4000);
  assert.match(slice, /Saqqara/);
});

check('Cult-vs-historical Imhotep caveat present', () => {
  const idx = html.indexOf('id="imhotepTrials"');
  const slice = html.slice(idx, idx + 4000);
  assert.match(slice, /(cult|deified|veneration|New Kingdom|Old Kingdom)/i);
});

check('Door is non-interactive (locked state)', () => {
  const idx = html.indexOf('id="imhotepTrials"');
  const slice = html.slice(idx, idx + 4000);
  assert.match(slice, /aria-disabled="true"|class="[^"]*--locked/);
});

check('Tone-canon copy present', () => {
  const idx = html.indexOf('id="imhotepTrials"');
  const slice = html.slice(idx, idx + 4000);
  assert.match(slice, /The Trials are being prepared/);
  assert.match(slice, /The path remembers/);
});

check('Trials door styles in senebty.css', () => {
  assert.match(css, /\.senebty-trials-door/);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
