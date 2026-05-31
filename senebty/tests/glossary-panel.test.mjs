#!/usr/bin/env node
// senebty/tests/glossary-panel.test.mjs
// TDD tests for Task #205 — dedicated glossary panel UI.
// Covers: panel open/close state, sessionStorage-based persistence,
// entry rendering shape, and cite-line presence.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const NS       = fs.readFileSync(new URL('../lib/namespace.js',     import.meta.url), 'utf8');
const GLOSS_E  = fs.readFileSync(new URL('../lib/glossary-entries.js', import.meta.url), 'utf8');
const PANEL    = fs.readFileSync(new URL('../lib/glossary-panel.js',import.meta.url), 'utf8');

// ── sessionStorage stub ────────────────────────────────────────────────────
function makeSessionStorage(){
  const store = {};
  return {
    getItem(k){ return store[k]??null; },
    setItem(k,v){ store[k]=String(v); },
    removeItem(k){ delete store[k]; },
    _store: store
  };
}

// ── minimal DOM stub ───────────────────────────────────────────────────────
function makeDom(){
  const elements = new Map();
  function make(id){
    const el = {
      id, _text:'', _html:'', _children:[], _attrs:{},
      classList:{ _list:new Set(),
        add(c){ this._list.add(c); },
        remove(c){ this._list.delete(c); },
        toggle(c){ this._list.has(c)?this._list.delete(c):this._list.add(c); },
        contains(c){ return this._list.has(c); }
      },
      style:{},
      textContent:'', innerHTML:'',
      appendChild(c){ this._children.push(c); return c; },
      setAttribute(k,v){ this._attrs[k]=v; },
      getAttribute(k){ return this._attrs[k]??null; },
      addEventListener(){},
      focus(){},
      hidden:false,
      _tag:'div'
    };
    Object.defineProperty(el,'textContent',{get(){return el._text;},set(v){el._text=v;}});
    Object.defineProperty(el,'innerHTML',  {get(){return el._html;},set(v){el._html=v;}});
    elements.set(id,el);
    return el;
  }
  ['senebtyGlossaryPanel','senebtyGlossaryToggle','senebtyGlossaryList','senebtyGlossaryCite'].forEach(make);
  const body = make('_body_');
  return {
    document:{
      getElementById: id => elements.get(id)||null,
      createElement: tag => {
        const el = make('_'+tag+'_'+Math.random());
        el._tag=tag;
        return el;
      },
      body
    },
    _elements: elements
  };
}

const session = makeSessionStorage();
const dom = makeDom();

const ctx = Object.assign({ window:{}, Object, sessionStorage: session }, dom);
vm.createContext(ctx);
vm.runInContext(NS,      ctx);
vm.runInContext(GLOSS_E, ctx);
vm.runInContext(PANEL,   ctx);

const panel = ctx.window.Senebty.glossaryPanel;

let PASS=0, FAIL=0;
function check(name,fn){
  try { fn(); console.log('PASS '+name); PASS++; }
  catch(e){ console.error('FAIL '+name+' — '+e.message); FAIL++; }
}

// ── API surface ────────────────────────────────────────────────────────────
check('window.Senebty.glossaryPanel exposed', ()=>{
  assert.ok(panel, 'glossaryPanel not on window.Senebty');
});

check('panel exposes open() function', ()=>{
  assert.equal(typeof panel.open, 'function');
});

check('panel exposes close() function', ()=>{
  assert.equal(typeof panel.close, 'function');
});

check('panel exposes toggle() function', ()=>{
  assert.equal(typeof panel.toggle, 'function');
});

check('panel exposes isOpen() function', ()=>{
  assert.equal(typeof panel.isOpen, 'function');
});

// ── initial state ──────────────────────────────────────────────────────────
check('panel.isOpen() returns false when sessionStorage has no entry', ()=>{
  const freshSession = makeSessionStorage();
  const freshCtx = Object.assign({ window:{}, Object, sessionStorage: freshSession }, makeDom());
  vm.createContext(freshCtx);
  vm.runInContext(NS,     freshCtx);
  vm.runInContext(GLOSS_E,freshCtx);
  vm.runInContext(PANEL,  freshCtx);
  assert.equal(freshCtx.window.Senebty.glossaryPanel.isOpen(), false);
});

// ── open / close / toggle state  ──────────────────────────────────────────
check('open() sets isOpen() to true and persists in sessionStorage', ()=>{
  const s = makeSessionStorage();
  const d = makeDom();
  const c = Object.assign({ window:{}, Object, sessionStorage: s }, d);
  vm.createContext(c);
  vm.runInContext(NS,     c);
  vm.runInContext(GLOSS_E,c);
  vm.runInContext(PANEL,  c);
  const p = c.window.Senebty.glossaryPanel;
  p.open();
  assert.equal(p.isOpen(), true, 'isOpen() should be true after open()');
  assert.equal(s.getItem('senebty-glossary-open'), 'true', 'sessionStorage must reflect open state');
});

check('close() sets isOpen() to false and persists in sessionStorage', ()=>{
  const s = makeSessionStorage();
  const d = makeDom();
  const c = Object.assign({ window:{}, Object, sessionStorage: s }, d);
  vm.createContext(c);
  vm.runInContext(NS,     c);
  vm.runInContext(GLOSS_E,c);
  vm.runInContext(PANEL,  c);
  const p = c.window.Senebty.glossaryPanel;
  p.open();
  p.close();
  assert.equal(p.isOpen(), false, 'isOpen() should be false after close()');
  assert.equal(s.getItem('senebty-glossary-open'), 'false');
});

check('toggle() flips from closed to open', ()=>{
  const s = makeSessionStorage();
  const d = makeDom();
  const c = Object.assign({ window:{}, Object, sessionStorage: s }, d);
  vm.createContext(c);
  vm.runInContext(NS,     c);
  vm.runInContext(GLOSS_E,c);
  vm.runInContext(PANEL,  c);
  const p = c.window.Senebty.glossaryPanel;
  assert.equal(p.isOpen(), false);
  p.toggle();
  assert.equal(p.isOpen(), true);
});

check('toggle() flips from open to closed', ()=>{
  const s = makeSessionStorage();
  const d = makeDom();
  const c = Object.assign({ window:{}, Object, sessionStorage: s }, d);
  vm.createContext(c);
  vm.runInContext(NS,     c);
  vm.runInContext(GLOSS_E,c);
  vm.runInContext(PANEL,  c);
  const p = c.window.Senebty.glossaryPanel;
  p.open();
  p.toggle();
  assert.equal(p.isOpen(), false);
});

check('sessionStorage key is "senebty-glossary-open" (not localStorage)', ()=>{
  const s = makeSessionStorage();
  const d = makeDom();
  const c = Object.assign({ window:{}, Object, sessionStorage: s }, d);
  vm.createContext(c);
  vm.runInContext(NS,     c);
  vm.runInContext(GLOSS_E,c);
  vm.runInContext(PANEL,  c);
  const p = c.window.Senebty.glossaryPanel;
  p.open();
  assert.ok(s._store['senebty-glossary-open'] !== undefined, 'key senebty-glossary-open missing from sessionStorage');
});

// ── cite line ─────────────────────────────────────────────────────────────
check('panel exposes CITE_LINE constant with required sources', ()=>{
  assert.ok(panel.CITE_LINE, 'CITE_LINE missing from glossaryPanel');
  assert.ok(panel.CITE_LINE.includes('Allen 2014'), 'Allen 2014 missing');
  assert.ok(panel.CITE_LINE.includes('Faulkner 1962'), 'Faulkner 1962 missing');
  assert.ok(panel.CITE_LINE.includes('Nunn 1996'), 'Nunn 1996 missing');
  assert.ok(panel.CITE_LINE.includes('Obenga 2004'), 'Obenga 2004 missing');
  assert.ok(panel.CITE_LINE.includes('Cultural Consensus Panel'), 'Cultural Consensus Panel missing');
});

// ── tone check ─────────────────────────────────────────────────────────────
check('panel exposes PANEL_LABEL constant in Seba register (no exclamation, no cartoon mascot voice)', ()=>{
  assert.ok(panel.PANEL_LABEL, 'PANEL_LABEL missing');
  assert.ok(!panel.PANEL_LABEL.includes('!'), 'PANEL_LABEL contains exclamation point — tone violation');
  const banned = ['Browse','glossary','Amazing','Great','Awesome'];
  for (const word of banned){
    assert.ok(!panel.PANEL_LABEL.includes(word), `PANEL_LABEL contains banned word: "${word}"`);
  }
});

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
