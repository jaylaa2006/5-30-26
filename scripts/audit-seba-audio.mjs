#!/usr/bin/env node
// scripts/audit-seba-audio.mjs — Phase v3.33.0
// Generates docs/superpowers/coverage/seba-audio.md with pool, MP3, and
// call-site coverage. Per architecture-gate recommended addition #8.
import fs from 'node:fs';
import path from 'node:path';

const HTML = fs.readFileSync('maat-reader.html', 'utf8');

function extract(html, marker){
  const i = html.indexOf(marker);
  if (i === -1) throw new Error('marker not found: ' + marker);
  let j = html.indexOf('{', i);
  let depth = 0, k = j;
  while (k < html.length){
    const c = html[k];
    if (c === '{') depth++;
    else if (c === '}'){ depth--; if (depth === 0) break; }
    else if (c === "'"||c==='"'||c==='`'){
      const q = c; k++;
      while (k < html.length && html[k] !== q){ if (html[k] === '\\') k++; k++; }
    }
    k++;
  }
  return html.slice(j, k+1);
}

// Use the same JS-literal-to-JSON converter from generate-seba-quips.mjs
// to avoid eval / new Function (security hook). Tolerant of single quotes
// and unquoted keys.
function jsLiteralToJson(src){
  // Quote unquoted keys: { foo: ... } -> { "foo": ... }
  src = src.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":');
  // Replace single-quoted strings with double-quoted (handle escapes minimally)
  src = src.replace(/'((?:[^'\\]|\\.)*)'/g, (_, body) => {
    return '"' + body.replace(/\\'/g, "'").replace(/"/g, '\\"') + '"';
  });
  // Strip trailing commas before } or ]
  src = src.replace(/,(\s*[}\]])/g, '$1');
  return src;
}

const Y = JSON.parse(jsLiteralToJson(extract(HTML, 'YOUNG_SEBA_QUIPS:')));
const E = JSON.parse(jsLiteralToJson(extract(HTML, 'ELDER_SEBA_QUIPS:')));

const POOLS = {
  'young-mer': Y.mer,
  'young-sedjm': Y.sedjm,
  'young-rekh': Y.rekh,
  'young-celebration': Y.celebration,
  'young-achievement': Y.achievement,
  'elder-sema': E.sema,
  'elder-sema-daily': E.semaDaily,
  'elder-sema-redirect': E.semaRedirect,
  'elder-sema-approval': E.semaApproval,
};

// Find all _playSebaQuip(register, persona, ...) call sites via regex.
// Captures both `this._playSebaQuip(...)` and `App._playSebaQuip(...)` forms
// (Senebty IIFE wrapper case from Task 13). The regex matches the bare
// method name so the `this.` / `App.` prefix is irrelevant.
const callSites = [];
const re = /_playSebaQuip\(\s*['"]?([\w.]+)['"]?\s*,\s*['"]?(young|elder)['"]?/g;
let m;
while ((m = re.exec(HTML)) !== null){
  callSites.push({ register: m[1], persona: m[2], index: m.index });
}

// Map register name (e.g. 'semaDaily') -> pool key (e.g. 'elder-sema-daily')
const RAW_TO_POOL = { semaDaily: 'sema-daily', semaRedirect: 'sema-redirect', semaApproval: 'sema-approval' };
function poolKeyForCall(register, persona){
  return persona + '-' + (RAW_TO_POOL[register] || register);
}

// Known register literals per persona (used to resolve variable-based calls
// like `_playSebaQuip(computedRegister, 'young', ...)` where the variable
// is computed from a small set of nearby string literals).
const KNOWN_REGISTERS = {
  young: ['mer', 'sedjm', 'rekh', 'celebration', 'achievement'],
  elder: ['sema', 'semaDaily', 'semaRedirect', 'semaApproval'],
};

// For a variable-based call, scan a 60-line window above the call site for
// literal register strings that the variable could resolve to. Also detect
// references to `evaluation.register` / `pc.register` — those are sourced
// from the seba-story-api and can carry any persona register, so we treat
// them as wiring every known register for the persona.
function resolveVariableCall(call){
  const knownLiterals = KNOWN_REGISTERS[call.persona] || [];
  // Window: 4000 chars before the call site (approx 60 lines).
  const windowStart = Math.max(0, call.index - 4000);
  const windowText = HTML.slice(windowStart, call.index);
  const found = new Set();
  for (const lit of knownLiterals){
    // Match the literal as a quoted string in the window.
    const litRe = new RegExp(`['"]${lit}['"]`, 'g');
    if (litRe.test(windowText)) found.add(lit);
  }
  // Backend-sourced register: assume full coverage of persona registers.
  if (/\b(evaluation|pc|pendingChallenge)\.register\b/.test(windowText)){
    for (const lit of knownLiterals) found.add(lit);
  }
  return [...found];
}

const wired = new Set();
const resolvedCalls = [];
for (const c of callSites){
  // If register matches a known literal, treat as direct.
  const persona = c.persona;
  const known = KNOWN_REGISTERS[persona] || [];
  if (known.includes(c.register)){
    wired.add(poolKeyForCall(c.register, persona));
    resolvedCalls.push({ ...c, resolved: [c.register], dynamic: false });
  } else {
    // Variable-based call — resolve via window scan.
    const resolved = resolveVariableCall(c);
    for (const r of resolved) wired.add(poolKeyForCall(r, persona));
    resolvedCalls.push({ ...c, resolved, dynamic: true });
  }
}

// Build the report.
const lines = [
  '# Seba Audio Coverage Report',
  '',
  `_Generated: ${new Date().toISOString()}_`,
  '',
  '_Source: `maat-reader.html` (YOUNG_SEBA_QUIPS + ELDER_SEBA_QUIPS) + `public/audio/seba/`_',
  '',
  '| Pool | Quips | Audio MP3s | Wired call sites |',
  '|---|---|---|---|',
];

let totalQuips = 0, totalMp3 = 0;
for (const [poolKey, arr] of Object.entries(POOLS)){
  const dir = path.join('public/audio/seba', poolKey);
  let mp3 = 0;
  try { mp3 = fs.readdirSync(dir).filter(f => f.endsWith('.mp3')).length; } catch(e){}
  totalQuips += (arr?.length || 0);
  totalMp3 += mp3;
  lines.push(`| \`${poolKey}\` | ${arr?.length || 0} | ${mp3} | ${wired.has(poolKey) ? 'YES' : 'NO'} |`);
}

lines.push('| **Total** | **' + totalQuips + '** | **' + totalMp3 + '** | **' + wired.size + ' / ' + Object.keys(POOLS).length + '** |');
lines.push('');
lines.push('## Call sites detected');
lines.push('');
for (const c of resolvedCalls){
  if (c.dynamic){
    const pools = c.resolved.map(r => `\`${poolKeyForCall(r, c.persona)}\``).join(', ');
    const poolList = pools || '_(unresolved)_';
    lines.push(`- \`_playSebaQuip(${c.register}, '${c.persona}', ...)\` (dynamic) -> pools ${poolList}`);
  } else {
    lines.push(`- \`_playSebaQuip('${c.register}', '${c.persona}', ...)\` -> pool \`${poolKeyForCall(c.register, c.persona)}\``);
  }
}
lines.push('');
lines.push('## Coverage gaps');
lines.push('');
const gaps = Object.keys(POOLS).filter(k => !wired.has(k));
if (gaps.length === 0){
  lines.push('_None — all 9 pools have at least one wired call site._');
} else {
  for (const g of gaps) lines.push('- WARNING: Pool `' + g + '` has no wired call site.');
}
lines.push('');

const outPath = 'docs/superpowers/coverage/seba-audio.md';
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join('\n') + '\n');
console.log(lines.join('\n'));
