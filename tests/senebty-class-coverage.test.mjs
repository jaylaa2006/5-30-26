// senebty-class-coverage.test.mjs — v3.48.8 (RT consensus, PM/Khepri binding)
//
// Lint that prevents the wired-naked-class regression. Every senebty-*
// class used in maat-reader.html or senebty/lib/*.js MUST have a matching
// CSS rule somewhere in senebty/styles/*.css or in an inline <style> block.
//
// Rationale: v3.48.6 / v3.48.7 / v3.48.8 all shipped fixes for the same
// failure mode — class wired in HTML, zero CSS rules, browser defaults
// bleeding through. This lint catches the next one before users do.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const HTML_PATH = path.join(ROOT, 'maat-reader.html');
const CSS_PATH = path.join(ROOT, 'senebty', 'styles', 'senebty.css');
const CSS_DIR = path.join(ROOT, 'senebty', 'styles');
const LIB_DIR = path.join(ROOT, 'senebty', 'lib');

const ALLOWLIST = new Set([
  // (empty at v3.48.8 — add only with one-line justification)
  'senebty-rituals',  // URL path segment in VEO_AVAILABLE (/videos/senebty-rituals/…), not a CSS class
  'senebty-foundation-stage--reading',  // v3.51.9 — intentional no-op toggle (v3.51.5 spread CSS removed; toggle kept for back-compat with external code expecting the class)
  'senebty-foundations',  // v3.51.41 — URL path segment in daily-foundation doingVeo fallback (/videos/senebty-foundations/<slug>-drink.mp4), not a CSS class
]);

function classesFromHtmlAttrs(text) {
  const out = new Set();
  const re = /class\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    for (const t of m[1].split(/\s+/)) if (t.startsWith('senebty-')) out.add(t);
  }
  return out;
}

function classesFromJsLiterals(text) {
  // Strip // line comments and /* ... */ block comments — doc-filename mentions
  // inside comments (e.g., "see senebty-v1-finish-design.md") should not count.
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1');
  const out = new Set();
  const re = /senebty-[a-z][a-z0-9_-]*/g;
  let m;
  while ((m = re.exec(stripped)) !== null) out.add(m[0]);
  return out;
}

function definedSelectorsFromCss(text) {
  const out = new Set();
  const re = /\.senebty-[a-z][a-z0-9_-]*/g;
  let m;
  while ((m = re.exec(text)) !== null) out.add(m[0].slice(1));
  return out;
}

test('every senebty-* class used in HTML or lib has a CSS rule', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');

  const used = new Set();
  for (const c of classesFromHtmlAttrs(html)) used.add(c);

  const inlineStyleBlocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  let inlineCss = '';
  for (const blk of inlineStyleBlocks) inlineCss += blk + '\n';

  if (fs.existsSync(LIB_DIR)) {
    const libFiles = fs.readdirSync(LIB_DIR).filter(f => f.endsWith('.js'));
    for (const f of libFiles) {
      const txt = fs.readFileSync(path.join(LIB_DIR, f), 'utf8');
      for (const c of classesFromJsLiterals(txt)) used.add(c);
    }
  }

  // v3.51.41 — scan ALL stylesheets in senebty/styles/, not just senebty.css.
  // Per-screen stylesheets (daily-foundation.css etc.) are loaded separately
  // but their classes are still real definitions.
  const defined = new Set();
  if (fs.existsSync(CSS_DIR)) {
    const cssFiles = fs.readdirSync(CSS_DIR).filter(f => f.endsWith('.css'));
    for (const f of cssFiles) {
      const txt = fs.readFileSync(path.join(CSS_DIR, f), 'utf8');
      for (const s of definedSelectorsFromCss(txt)) defined.add(s);
    }
  } else {
    const css = fs.readFileSync(CSS_PATH, 'utf8');
    for (const s of definedSelectorsFromCss(css)) defined.add(s);
  }
  for (const s of definedSelectorsFromCss(inlineCss)) defined.add(s);

  const missing = [];
  for (const c of used) {
    if (ALLOWLIST.has(c)) continue;
    if (!defined.has(c)) missing.push(c);
  }

  if (missing.length) {
    missing.sort();
    const msg = `\n${missing.length} senebty-* class(es) used in HTML/lib have NO matching CSS rule:\n  - ${missing.join('\n  - ')}\n\nAdd CSS in senebty/styles/senebty.css OR allowlist in this test with a one-line reason.\n`;
    assert.fail(msg);
  }
});
