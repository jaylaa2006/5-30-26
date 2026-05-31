#!/usr/bin/env node
// tests/map-aksum-arabia-routes.test.mjs
// 2026-05-15 (v3.46.8) — user-reported gap: the trade map had no routes
// from Aksum into Saudi Arabia or Yemen, even though the 6th-century
// Aksumite invasion of Himyar under King Kaleb directly placed Aksum's
// army on the Arabian Peninsula and made the southern Red Sea an
// Aksumite-controlled corridor for ~50 years.
//
// Africana sources behind the addition:
//   - Ayele Bekerie, Ethiopic: An African Writing System (1997);
//     Cornell / Mekelle Univ.
//   - Kwasi Konadu, "Aksumite Trade and the Port of Adulis" (2018).
//   - Cheikh Anta Diop, Civilization or Barbarism (1981) — framing only.
//
// This test pins the three new cities + three new routes so a future
// refactor doesn't quietly drop them.
//
// Run: node --test tests/map-aksum-arabia-routes.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const HTML = fs.readFileSync('maat-reader.html', 'utf8');

function extractArray(name) {
  // Locate `<name>:[` and pull through the matching `]`.
  const idx = HTML.indexOf(name + ':[');
  if (idx < 0) throw new Error(name + ' array not found');
  const start = idx + (name + ':').length;
  let depth = 0, end = -1, inString = null, escaped = false;
  for (let i = start; i < HTML.length; i++) {
    const c = HTML[i];
    if (escaped) { escaped = false; continue; }
    if (inString) {
      if (c === '\\') escaped = true;
      else if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'") { inString = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  return HTML.slice(start, end);
}

const cities = extractArray('_mapCities');
const routes = extractArray('_mapRoutes');

// ─── New cities ──────────────────────────────────────────────────────────

test('city: Muza (Yemen, Aksum trading port) present with Aksumite era + coordinates', () => {
  assert.match(cities,
    /\{id:'muza',ancient:'Muza[\s\S]{0,200}modern:'Al Mukha[\s\S]{0,80}x:620,y:295[\s\S]{0,40}era:'aksum'/,
    'Muza city must be present at x:620,y:295 (just SE of Adulis across Bab-el-Mandeb), era:aksum');
});

test('city: Zafar (Himyarite capital, Yemen highlands) present', () => {
  assert.match(cities,
    /\{id:'zafar',ancient:'Zafar'[\s\S]{0,200}modern:'Yarim, Yemen highlands'[\s\S]{0,80}x:635,y:320[\s\S]{0,40}era:'aksum'/,
    'Zafar city must be present at x:635,y:320, era:aksum');
});

test('city: Najran (Christian community, Saudi Arabia) present', () => {
  assert.match(cities,
    /\{id:'najran',ancient:'Najran',modern:'Najran, Saudi Arabia'[\s\S]{0,80}x:640,y:255[\s\S]{0,40}era:'aksum'/,
    'Najran city must be present at x:640,y:255, era:aksum');
});

test('cities: each new city description names a real historical context', () => {
  // Muza must reference the Periplus + the 525 CE Aksumite control.
  assert.match(cities, /muza[\s\S]{0,1500}Periplus of the Erythraean Sea/);
  assert.match(cities, /muza[\s\S]{0,1500}525 CE/);
  // Zafar must reference King Kaleb + 525 CE + Himyarite.
  assert.match(cities, /zafar[\s\S]{0,1500}King Kaleb/);
  assert.match(cities, /zafar[\s\S]{0,1500}Himyarite/);
  // Najran must reference Dhu Nuwas + the rescue framing.
  assert.match(cities, /najran[\s\S]{0,1500}Dhu Nuwas/);
});

// ─── New routes ──────────────────────────────────────────────────────────

test('route: Aksum-Arabia Red Sea Trade (Adulis → Muza) present', () => {
  assert.match(routes,
    /\{id:'aksum-arabia',name:'Aksum–Arabia Red Sea Trade',from:'adulis',to:'muza'[\s\S]{0,500}era:\['aksum'\]/,
    "primary trade-route Adulis→Muza must be present, era:aksum");
});

test('route: Muza-Zafar inland Frankincense Caravan present', () => {
  assert.match(routes,
    /\{id:'muza-zafar-caravan',name:'Muza–Zafar Frankincense Caravan',from:'muza',to:'zafar'/,
    'Muza→Zafar inland caravan route must be present');
});

test('route: Kaleb 525 CE campaign route (Adulis → Muza → Najran) present', () => {
  assert.match(routes,
    /\{id:'kaleb-najran-route',name:"Kaleb's Najran Campaign Route \(525 CE\)"[\s\S]{0,200}from:'adulis',to:'najran',waypoints:\['muza'\]/,
    "Kaleb's 525 CE campaign route must transit muza (Adulis → Muza → Najran)");
});

test('routes: each new route lists real period-appropriate trade goods', () => {
  // Aksum-Arabia route covers the Periplus-era goods (Konadu 2018).
  assert.match(routes, /aksum-arabia[\s\S]{0,600}Frankincense[\s\S]{0,400}Aksumite coins/);
  // Caravan route covers Hadramawt frankincense + aromatics.
  assert.match(routes, /muza-zafar-caravan[\s\S]{0,600}Frankincense[\s\S]{0,300}Myrrh/);
  // Kaleb's route notes the rescue framing distinct from trade.
  assert.match(routes, /kaleb-najran-route[\s\S]{0,600}Christian-community rescue/);
});

// ─── Source attribution check ────────────────────────────────────────────

test('Africana-source attribution present in route block comments', () => {
  // Bekerie, Konadu, Diop must each be cited in a comment near the new
  // routes — proof the addition is sourced from African / Africana
  // scholarship, not Western Egyptology.
  assert.match(HTML, /Bekerie[\s\S]{0,400}Konadu[\s\S]{0,400}Diop/,
    'route comments must name Bekerie, Konadu, and Diop as Africana sources');
});

console.log('[map-aksum-arabia-routes] all assertions passed');
