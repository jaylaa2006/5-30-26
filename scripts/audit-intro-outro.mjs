#!/usr/bin/env node
// Audit which stories are missing per-story INTRO and OUTRO videos, per STORY_SET.
// Ground truth: _introVideoSlugs manifest (intros) + videos/outros/*.mp4 (outros).
import { readFileSync, readdirSync } from 'fs';

const html = readFileSync('maat-reader.html', 'utf8');

// --- parse _introVideoSlugs ---
const introM = html.match(/_introVideoSlugs:\s*new Set\(\[([^\]]*)\]\)/);
const introSlugs = new Set(
  (introM ? introM[1] : '').split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
);

// --- outros that exist on disk (local == prod, verified) ---
const outroFiles = new Set(
  readdirSync('videos/outros').filter(f => f.endsWith('.mp4')).map(f => f.replace(/\.mp4$/, ''))
);

// --- parse STORY_SETS block ---
const start = html.indexOf('const STORY_SETS = {');
const block = html.slice(start, html.indexOf('\n};', start));
const setRe = /(\w+):\s*\{\s*name:\s*(['"])(.*?)\2,\s*storyIds:\s*\[([^\]]*)\],\s*introVideo:\s*([^,]+),\s*outroVideo:\s*([^\n}]+)/g;

const SPECIAL = { yeshuasWay: true, sagePertEmHeru: true };

const rows = [];
for (const m of block.matchAll(setRe)) {
  const [, key, , name, idsRaw, introV, outroV] = m;
  const ids = idsRaw.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  const missingIntros = ids.filter(id => !introSlugs.has(id));
  const missingOutros = ids.filter(id => !outroFiles.has(id));
  rows.push({ key, name, total: ids.length, missingIntros, missingOutros,
    setIntro: introV.trim() === 'null', setOutro: outroV.trim().replace(/[},\s]*$/, '') === 'null' });
}

function report(title, predicate) {
  console.log('\n========== ' + title + ' ==========');
  for (const r of rows.filter(predicate)) {
    console.log(`\n[${r.key}] ${r.name}  (${r.total} stories)`);
    console.log(`  intros: ${r.total - r.missingIntros.length}/${r.total} have  |  set bookend intro:${r.setIntro?'MISSING':'ok'} outro:${r.setOutro?'MISSING':'ok'}`);
    console.log(r.missingIntros.length ? '  PENDING INTROS (' + r.missingIntros.length + '): ' + r.missingIntros.join(', ') : '  PENDING INTROS: none');
    console.log('  per-story outros present: ' + (r.total - r.missingOutros.length) + '/' + r.total);
  }
}

report('YESHUA\'S WAY', r => r.key === 'yeshuasWay');
report('SAGE PERT EM HERU', r => r.key === 'sagePertEmHeru');
report('GENERAL LIBRARY (all other sets)', r => !SPECIAL[r.key]);

const allMissingIntros = rows.flatMap(r => r.missingIntros);
console.log('\n========== TOTALS ==========');
console.log('manifest intro slugs:', introSlugs.size, '| outro files:', outroFiles.size);
console.log('TOTAL stories missing a per-story intro across all sets:', allMissingIntros.length);
