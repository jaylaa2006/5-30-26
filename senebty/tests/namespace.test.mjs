#!/usr/bin/env node
// Validates senebty/lib/namespace.js initializes window.Senebty correctly when loaded as a script.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const SRC = fs.readFileSync(new URL('../lib/namespace.js', import.meta.url), 'utf8');

let PASS = 0, FAIL = 0;
function check(name, fn){ try { fn(); console.log('PASS ' + name); PASS++; } catch(e){ console.error('FAIL ' + name + ' — ' + e.message); FAIL++; } }

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(SRC, ctx);

check('window.Senebty exists', () => assert.ok(ctx.window.Senebty, 'Senebty namespace not created'));
check('window.Senebty.version is a string', () => assert.equal(typeof ctx.window.Senebty.version, 'string'));
check('window.Senebty does not clobber pre-existing namespace', () => {
  const ctx2 = { window: { Senebty: { preExisting: 'keep me' } } };
  vm.createContext(ctx2);
  vm.runInContext(SRC, ctx2);
  assert.equal(ctx2.window.Senebty.preExisting, 'keep me', 'pre-existing namespace was clobbered');
  assert.ok(ctx2.window.Senebty.version, 'version not added on top of existing namespace');
});

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
