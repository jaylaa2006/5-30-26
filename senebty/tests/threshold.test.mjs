#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const NS = fs.readFileSync(new URL('../lib/namespace.js', import.meta.url), 'utf8');
const TH = fs.readFileSync(new URL('../lib/threshold.js', import.meta.url), 'utf8');

const ctx = { window: {}, Object, setTimeout: (fn) => fn(), clearTimeout: () => {} };
vm.createContext(ctx);
vm.runInContext(NS, ctx);
vm.runInContext(TH, ctx);

const T = ctx.window.Senebty.threshold;

let PASS = 0, FAIL = 0;
function check(name, fn){ try { fn(); console.log('PASS ' + name); PASS++; } catch(e){ console.error('FAIL ' + name + ' — ' + e.message); FAIL++; } }

check('threshold.maybePlayIntro exists', () => assert.equal(typeof T.maybePlayIntro, 'function'));

check('first inbound crossing returns true and flips firstCrossSeen', () => {
  const app = { user: { senebty: { firstCrossSeen: false, firstReturnSeen: false } }, saveUser(){ this._saved = true; } };
  const played = T.maybePlayIntro(app, 'inbound');
  assert.equal(played, true);
  assert.equal(app.user.senebty.firstCrossSeen, true);
  assert.equal(app._saved, true);
});

check('subsequent inbound crossing returns false and does NOT replay', () => {
  const app = { user: { senebty: { firstCrossSeen: true, firstReturnSeen: false } }, saveUser(){} };
  const played = T.maybePlayIntro(app, 'inbound');
  assert.equal(played, false);
});

check('first outbound crossing returns true and flips firstReturnSeen', () => {
  const app = { user: { senebty: { firstCrossSeen: true, firstReturnSeen: false } }, saveUser(){ this._saved = true; } };
  const played = T.maybePlayIntro(app, 'outbound');
  assert.equal(played, true);
  assert.equal(app.user.senebty.firstReturnSeen, true);
  assert.equal(app._saved, true);
});

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
