#!/usr/bin/env node
// Pre-deploy syntax gate for maat-reader.html (or any other HTML file passed in).
// Extracts every inline <script> block and parse-checks it using vm.Script, which
// compiles without executing — the same parse contract the browser applies when
// it loads a classic script tag. Exits non-zero if any block fails to parse.
//
// Run locally:
//   node scripts/syntax-check.mjs maat-reader.html
// Default target is maat-reader.html relative to CWD.
//
// Wire into the deploy script BEFORE any rsync/tar-pipe step.

import fs from 'node:fs';
import vm from 'node:vm';

const target = process.argv[2] || 'maat-reader.html';
if (!fs.existsSync(target)) {
  console.error(`syntax-check: file not found: ${target}`);
  process.exit(1);
}

const src = fs.readFileSync(target, 'utf8');
const tagRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

let inlineCount = 0;
let failures = 0;
for (const m of src.matchAll(tagRe)) {
  const attrs = m[1] || '';
  const body = m[2] || '';
  if (/\bsrc\s*=/.test(attrs)) continue; // external — skip
  const typeMatch = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
  if (typeMatch) {
    const t = typeMatch[1].toLowerCase();
    if (!['text/javascript', 'application/javascript', 'module'].includes(t)) continue;
  }
  inlineCount++;
  try {
    // Construct-only: vm.Script parses/compiles the string but does NOT run it.
    // This is the same error surface as a browser parse — which is what catches
    // regressions like the duplicate `const` collision that broke prod this session.
    new vm.Script(body, { filename: `${target}::inline#${inlineCount}` });
  } catch (err) {
    failures++;
    console.error(`FAIL inline <script> #${inlineCount} at offset ${m.index}: ${err.message}`);
  }
}

if (failures > 0) {
  console.error(`\nsyntax-check FAILED: ${failures} of ${inlineCount} inline <script> block(s) did not parse in ${target}`);
  process.exit(1);
}
console.log(`syntax-check OK: ${inlineCount} inline <script> block(s) parse in ${target}`);
