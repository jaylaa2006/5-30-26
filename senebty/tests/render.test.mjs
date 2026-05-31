#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const NS = fs.readFileSync(new URL('../lib/namespace.js', import.meta.url), 'utf8');
const TIERS = fs.readFileSync(new URL('../lib/tiers.js', import.meta.url), 'utf8');
const RENDER = fs.readFileSync(new URL('../lib/render.js', import.meta.url), 'utf8');

// Minimal DOM stub
// Phase 1.2 round-table follow-up (Sam): mock element now carries a `dataset`
// object + `addEventListener` no-op so `_wireRingClicks` (render.js ~line 35)
// can read `ringsEl.dataset.senebtyRingClicks` and bind delegated click /
// keydown handlers without throwing. Without these the tier-badge / ring-render
// tests all crashed with "Cannot read properties of undefined (reading
// 'senebtyRingClicks')" — pre-existing failure that masked render regressions.
function makeDom(){
  const elements = new Map();
  const make = (id, tagName) => {
    const el = {
      id,
      _text: '', _html: '', _children: [],
      textContent: '', innerHTML: '',
      tagName: tagName ? String(tagName).toUpperCase() : undefined,
      dataset: {},                                    // Sam: required by _wireRingClicks idempotency guard
      _attrs: {},
      children: [],
      firstElementChild: null,
      appendChild(c){
        this._children.push(c);
        this.children.push(c);
        if (!this.firstElementChild) this.firstElementChild = c;
        return c;
      },
      replaceChildren(){
        this._children.length = 0;
        this.children.length = 0;
        this.firstElementChild = null;
        el._text = '';
      },
      classList: { add(){}, remove(){}, toggle(){} },
      setAttribute(k,v){ this._attrs[k] = String(v); },
      getAttribute(k){ return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; },
      addEventListener(){}, removeEventListener(){},  // Sam: required by _wireRingClicks
      contains(){ return false; }, closest(){ return null; },
      hidden: false,
    };
    Object.defineProperty(el, 'textContent', { get(){ return el._text; }, set(v){ el._text = v; } });
    Object.defineProperty(el, 'innerHTML', { get(){ return el._html; }, set(v){ el._html = v; } });
    if (id) elements.set(id, el);
    return el;
  };
  ['senebtyTierGlyph','senebtyTierName','senebtyGateSeba','senebtyRings','senebtyTierBadge'].forEach(id => make(id));
  return {
    document: {
      getElementById: id => elements.get(id) || null,
      createElement: tag => make('_'+tag+'_'+Math.random(), tag)
    },
    _elements: elements,
    _make: make
  };
}

const ctx = Object.assign({ window: {}, Object }, makeDom());
vm.createContext(ctx);
vm.runInContext(NS, ctx);
vm.runInContext(TIERS, ctx);
vm.runInContext(RENDER, ctx);

const render = ctx.window.Senebty.render;

let PASS = 0, FAIL = 0;
function check(name, fn){ try { fn(); console.log('PASS ' + name); PASS++; } catch(e){ console.error('FAIL ' + name + ' — ' + e.message); FAIL++; } }

check('render.gate exists', () => assert.equal(typeof render.gate, 'function'));

check('gate(App) populates tier badge for tier 0 (Hem-Sba)', () => {
  const app = { user: { senebty: { tier: 0 } } };
  render.gate(app);
  assert.equal(ctx._elements.get('senebtyTierName').textContent, 'Hem-Sba');
});

check('gate(App) populates tier badge for tier 4 (Sunu Sba)', () => {
  const app = { user: { senebty: { tier: 4 } } };
  render.gate(app);
  assert.equal(ctx._elements.get('senebtyTierName').textContent, 'Sunu Sba');
});

check('gate(App) renders 3 ring blocks (Foundations, Rekh Domains, Trials)', () => {
  const app = { user: { senebty: { tier: 0 } } };
  render.gate(app);
  const ringsHtml = ctx._elements.get('senebtyRings').innerHTML;
  assert.ok(ringsHtml.includes('Foundations'), 'Foundations ring missing');
  assert.ok(ringsHtml.includes('Rekh'), 'Rekh ring missing');
  assert.ok(ringsHtml.includes('Trials'), 'Trials ring missing');
});

check('Ring 2 + 3 marked --locked when tier < unlock threshold', () => {
  const app = { user: { senebty: { tier: 0 } } };
  render.gate(app);
  const ringsHtml = ctx._elements.get('senebtyRings').innerHTML;
  // Visible-but-dim per UX verdict — count occurrences of locked class
  const lockedMatches = ringsHtml.match(/senebty-ring--locked/g) || [];
  assert.equal(lockedMatches.length, 2, 'expected 2 locked rings (Rekh + Trials) at tier 0');
});

// Phase 1.2 round-table (Khepri/Maya): tier badge truncates 3+ codepoints
// to the first 2 — T2 sesh-en-per-ankh's 4-sign mdwNtr would otherwise clip
// at half-width inside the tier badge's 50px max-width column.
check('tierBadgeGlyph: empty string passes through', () => {
  assert.equal(render.tierBadgeGlyph(''), '');
  assert.equal(render.tierBadgeGlyph(null), '');
  assert.equal(render.tierBadgeGlyph(undefined), '');
});
check('tierBadgeGlyph: 1-codepoint mdwNtr unchanged', () => {
  // Single hieroglyph (D60 = 𓃂 = U+130C2 — wabau Africana corrected)
  assert.equal(render.tierBadgeGlyph('\u{130C2}'), '\u{130C2}');
});
check('tierBadgeGlyph: 2-codepoint mdwNtr unchanged', () => {
  // 2-sign string (legacy hem-sba shape) — both signs render
  const s = '\u{132F4}\u{1342F}';
  assert.equal(render.tierBadgeGlyph(s), s);
});
check('tierBadgeGlyph: 4-codepoint mdwNtr truncates to first 2 (T2 sesh-en-per-ankh)', () => {
  // T2 = U+13351 + U+13216 + U+13250 + U+132F9 (sš + n + house + ankh)
  const full = '\u{13351}\u{13216}\u{13250}\u{132F9}';
  const expected = '\u{13351}\u{13216}';  // first 2 only
  assert.equal(render.tierBadgeGlyph(full), expected);
});
check('tierBadgeGlyph: surrogate-pair safety — no mid-surrogate split', () => {
  // 5-sign senebty s-n-b-t-y string. Naive .slice(0,2) would split a
  // surrogate pair and yield a lone-surrogate truncation.
  const full = '\u{132F4}\u{13216}\u{130C0}\u{133CF}\u{133ED}';
  const truncated = render.tierBadgeGlyph(full);
  assert.equal([...truncated].length, 2, 'truncated must contain exactly 2 codepoints, not split surrogates');
});

// Phase 1.3 — sigil render branch.
// When tier.mdwNtr === null AND tier.sigilSrc is set, gate() appends an <img>
// to #senebtyTierGlyph instead of setting textContent.
function _resetGlyph(){
  const fresh = ctx._make('senebtyTierGlyph');
  ctx._elements.set('senebtyTierGlyph', fresh);
  return fresh;
}

check('gate() appends <img> sigil when tier has mdwNtr=null + sigilSrc set', () => {
  const originalSrc = ctx.window.Senebty.tiers[0].sigilSrc;
  ctx.window.Senebty.tiers[0].sigilSrc = '/images/senebty/sigils/hem-sba.png';
  const glyphEl = _resetGlyph();
  ctx.window.Senebty.render.gate({ user: { senebty: { tier: 0 } } });
  const img = glyphEl.firstElementChild;
  assert.ok(img && img.tagName === 'IMG', 'expected an IMG child, got: ' + (img && img.tagName));
  assert.equal(img.getAttribute('class'), 'senebty-tier-sigil');
  assert.equal(img.getAttribute('src'), '/images/senebty/sigils/hem-sba.png');
  assert.ok(img.getAttribute('alt') && img.getAttribute('alt').length > 0, 'img must have non-empty alt');
  assert.equal(img.getAttribute('loading'), 'lazy');
  ctx.window.Senebty.tiers[0].sigilSrc = originalSrc;
});

check('gate() falls back to textContent glyph when tier has mdwNtr (T2 attested) — no IMG child', () => {
  const glyphEl = _resetGlyph();
  ctx.window.Senebty.render.gate({ user: { senebty: { tier: 2 } } });
  assert.ok(!glyphEl.firstElementChild || glyphEl.firstElementChild.tagName !== 'IMG', 'attested-glyph tier must NOT render IMG');
  assert.ok(glyphEl.textContent && glyphEl.textContent.length > 0, 'expected glyph text fallback');
});

check('gate() falls back to empty when tier has mdwNtr=null AND sigilSrc=null (pre-asset state)', () => {
  const originalSrc = ctx.window.Senebty.tiers[0].sigilSrc;
  try {
    ctx.window.Senebty.tiers[0].sigilSrc = null;
    const glyphEl = _resetGlyph();
    ctx.window.Senebty.render.gate({ user: { senebty: { tier: 0 } } });
    assert.ok(!glyphEl.firstElementChild, 'no asset → no child');
    assert.equal(glyphEl.textContent, '');
  } finally {
    ctx.window.Senebty.tiers[0].sigilSrc = originalSrc;
  }
});

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
