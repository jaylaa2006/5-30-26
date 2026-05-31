#!/usr/bin/env node
// Tests for #211 idempotent init() and #209 CONFIDENCE_NOTE export
// in senebty/lib/glossary-panel.js.
//
// Usage: node tests/senebty-glossary-panel-idempotent.test.mjs

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  (cond ? console.log : console.error)(
    (cond ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : '')
  );
  cond ? PASS++ : FAIL++;
}

var panelSrc = readFileSync(
  resolve(__dirname, '../senebty/lib/glossary-panel.js'),
  'utf8'
);

function makeEnv(overrideGetById) {
  var addEventCallCount = 0;
  var fakeWindow = {
    Senebty: {
      glossaryEntries: {
        senebty: { name: 'Senebty', symbol: 'S', pron: 'seh-NEB-tee', brief: 'Be in health' }
      }
    },
    matchMedia: function() { return { matches: false }; }
  };
  var fakeSessionStorage = (function() {
    var store = {};
    return {
      getItem:    function(k)    { return store[k] !== undefined ? store[k] : null; },
      setItem:    function(k, v) { store[k] = String(v); },
      removeItem: function(k)    { delete store[k]; }
    };
  })();
  var defaultGetById = function(id) {
    if (id === 'senebtyGlossaryPanel')    return { classList: { add: function(){}, remove: function(){} }, setAttribute: function(){}, contains: function(){ return false; } };
    if (id === 'senebtyGlossaryToggle')   return { setAttribute: function(){}, contains: function(){ return false; } };
    if (id === 'senebtyGlossaryList')     return { innerHTML: '' };
    if (id === 'senebtyGlossaryCite')     return { textContent: '' };
    if (id === 'senebtyGlossaryConfidence') return null;
    return null;
  };
  var fakeDocument = {
    getElementById: overrideGetById || defaultGetById,
    addEventListener: function(type, fn) {
      if (type === 'click') { addEventCallCount++; }
    }
  };
  var ctx = vm.createContext({ window: fakeWindow, document: fakeDocument, sessionStorage: fakeSessionStorage });
  vm.runInContext(panelSrc, ctx);
  return { ctx, fakeWindow, fakeDocument, getClickCount: function(){ return addEventCallCount; } };
}

// ── #211: Idempotent init ──────────────────────────────────────────────────

var env = makeEnv();
var panel = env.fakeWindow.Senebty.glossaryPanel;

ok('glossaryPanel exists on window.Senebty', typeof panel === 'object' && panel !== null);
ok('init is a function', typeof panel.init === 'function');

panel.init();
panel.init();
panel.init();

ok(
  '#211: addEventListener("click") called exactly once after 3 init() calls',
  env.getClickCount() === 1,
  'got ' + env.getClickCount()
);

// ── #209: CONFIDENCE_NOTE export ──────────────────────────────────────────

ok(
  '#209: CONFIDENCE_NOTE is exported on glossaryPanel',
  typeof panel.CONFIDENCE_NOTE === 'string'
);

ok(
  '#209: CONFIDENCE_NOTE is non-empty',
  typeof panel.CONFIDENCE_NOTE === 'string' && panel.CONFIDENCE_NOTE.length > 0
);

ok(
  '#209: CONFIDENCE_NOTE contains the word MEDIUM',
  typeof panel.CONFIDENCE_NOTE === 'string' && panel.CONFIDENCE_NOTE.indexOf('MEDIUM') !== -1
);

// ── #209: confidence element gets populated on init ────────────────────────

var capturedConfidenceText = null;
var env2 = makeEnv(function(id) {
  if (id === 'senebtyGlossaryConfidence') {
    return {
      get textContent() { return capturedConfidenceText; },
      set textContent(v) { capturedConfidenceText = v; }
    };
  }
  if (id === 'senebtyGlossaryPanel')    return { classList: { add: function(){}, remove: function(){} }, setAttribute: function(){}, contains: function(){ return false; } };
  if (id === 'senebtyGlossaryToggle')   return { setAttribute: function(){}, contains: function(){ return false; } };
  if (id === 'senebtyGlossaryList')     return { innerHTML: '' };
  if (id === 'senebtyGlossaryCite')     return { textContent: '' };
  return null;
});

env2.fakeWindow.Senebty.glossaryPanel.init();

ok(
  '#209: init() sets #senebtyGlossaryConfidence textContent to CONFIDENCE_NOTE',
  capturedConfidenceText !== null && capturedConfidenceText.indexOf('MEDIUM') !== -1,
  'got: ' + capturedConfidenceText
);

// ── Summary ────────────────────────────────────────────────────────────────

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed.');
process.exit(FAIL === 0 ? 0 : 1);
