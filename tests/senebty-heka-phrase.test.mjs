// tests/senebty-heka-phrase.test.mjs
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
async function check(name, fn){
  try { await fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const src = fs.readFileSync('senebty/lib/heka-phrase.js', 'utf8');
const dom = new JSDOM('<!doctype html><html><body></body></html>');
const { window } = dom;
window.Senebty = window.Senebty || {};
new window.Function('window', src)(window);

function buildUser(overrides){
  return {
    id: 'u-test-001',
    name: 'Khaemwaset',
    parentPinHash: 'sha256:abc',
    senebty: {
      tier: 4,
      hekaPhrasePersonal: null,
      hekaPhraseSetAt: null,
      hekaPhraseEditableByChild: true,
      iriCompletedByLesson: { 'foundation-8-heka': { iriType:'TEACHING_IRI', confirmedAt: 1700000000000 } },
      ...overrides,
    },
    saveUser(){},
  };
}

async function main(){
  await check('hekaPhrase.set/get/openParentDeleteModal exist', () => {
    assert.equal(typeof window.Senebty.hekaPhrase.set, 'function');
    assert.equal(typeof window.Senebty.hekaPhrase.get, 'function');
    assert.equal(typeof window.Senebty.hekaPhrase.openParentDeleteModal, 'function');
  });

  await check('Storage keyed on user.id, never user.name (rename-safe)', () => {
    // Storage path: hekaPhrasePersonal is read/written on user.senebty (id-scoped via App.user)
    assert.match(src, /u\.senebty\.hekaPhrasePersonal/);
    // user.id is referenced (the gate that enables set/clear writes)
    assert.match(src, /u\.id/);
    // user.name is allowed for DISPLAY only — confirm it's not used as a write target.
    // Approximate check: any line that writes hekaPhrasePersonal must reference u.senebty, not u.name
    const writes = src.match(/hekaPhrasePersonal\s*=[^;]+;/g) || [];
    for (const w of writes) {
      assert.doesNotMatch(w, /u\.name/, `Write expression ${w} must not key on u.name`);
    }
  });

  await check('set() persists phrase + setAt', () => {
    window.App = { user: buildUser(), saveUser(){} };
    window.Senebty.hekaPhrase.set('Maat is breath I carry.');
    assert.equal(window.App.user.senebty.hekaPhrasePersonal, 'Maat is breath I carry.');
    assert.ok(window.App.user.senebty.hekaPhraseSetAt > 0);
  });

  await check('Parent delete modal requires parentPin re-entry', () => {
    window.App = { user: buildUser({ hekaPhrasePersonal:'X' }), saveUser(){}, _verifyPinServerSide:(p)=>(p==='1234') };
    window.Senebty.hekaPhrase.openParentDeleteModal();
    const pinInput = window.document.querySelector('input[name="senebty-heka-parent-pin"]');
    assert.ok(pinInput);
    assert.equal(pinInput.type, 'password');
  });

  await check('Delete copy names the child', () => {
    window.App = { user: buildUser({ hekaPhrasePersonal:'X' }), saveUser(){}, _verifyPinServerSide:()=>true };
    window.Senebty.hekaPhrase.openParentDeleteModal();
    assert.match(window.document.body.textContent, /Khaemwaset/);
    assert.match(window.document.body.textContent, /Tier returns from/);
  });

  await check('Confirm button is secondary-styled', () => {
    window.App = { user: buildUser({ hekaPhrasePersonal:'X' }), saveUser(){}, _verifyPinServerSide:()=>true };
    window.Senebty.hekaPhrase.openParentDeleteModal();
    const confirm = window.document.querySelector('.senebty-heka-parent-delete-confirm');
    assert.ok(confirm.classList.contains('btn-secondary'));
    assert.ok(!confirm.classList.contains('btn-destructive') && !confirm.classList.contains('btn-primary-destructive'));
  });

  await check('First-focus on Cancel', () => {
    window.App = { user: buildUser({ hekaPhrasePersonal:'X' }), saveUser(){}, _verifyPinServerSide:()=>true };
    window.Senebty.hekaPhrase.openParentDeleteModal();
    const cancel = window.document.querySelector('.senebty-heka-parent-delete-cancel');
    assert.equal(window.document.activeElement, cancel);
  });

  await check('Valid pin clears phrase + clears F8 iri + demotes tier', async () => {
    const u = buildUser({ hekaPhrasePersonal:'X', hekaPhraseSetAt: 1700000000000, tier: 4 });
    window.App = { user: u, saveUser(){}, _verifyPinServerSide:(p)=>(p==='1234') };
    window.Senebty.hekaPhrase.openParentDeleteModal();
    window.document.querySelector('input[name="senebty-heka-parent-pin"]').value = '1234';
    window.document.querySelector('.senebty-heka-parent-delete-confirm').click();
    // Async handler scheduled — drain microtasks before asserting state.
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(u.senebty.hekaPhrasePersonal, null);
    assert.equal(u.senebty.hekaPhraseSetAt, null);
    assert.equal(u.senebty.iriCompletedByLesson['foundation-8-heka'], undefined);
    assert.equal(u.senebty.tier, 3);
  });

  await check('Invalid pin does NOT clear phrase', async () => {
    const u = buildUser({ hekaPhrasePersonal:'X', hekaPhraseSetAt: 1700000000000 });
    window.App = { user: u, saveUser(){}, _verifyPinServerSide:(p)=>(p==='1234') };
    window.Senebty.hekaPhrase.openParentDeleteModal();
    window.document.querySelector('input[name="senebty-heka-parent-pin"]').value = 'wrong';
    window.document.querySelector('.senebty-heka-parent-delete-confirm').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(u.senebty.hekaPhrasePersonal, 'X');
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main();
