// SEO metadata contract (v3.51.69).
//
// Locks in the SEO head additions + crawl files so they can't silently regress:
//   - canonical link (matches og:url)
//   - robots meta (index, follow)
//   - Open Graph site_name + locale + image:alt
//   - JSON-LD structured data (valid JSON; WebSite + WebApplication + Organization)
//   - public/robots.txt (allows crawl, references the sitemap)
//   - public/sitemap.xml (valid urlset with the canonical home loc)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const HTML = readFileSync(join(ROOT, 'maat-reader.html'), 'utf8');
const CANON = 'https://perankh.osiriscare.net/';

test('canonical link is present and matches og:url', () => {
  const canon = HTML.match(/<link rel="canonical" href="([^"]+)">/);
  assert.ok(canon, 'canonical link must be present');
  assert.equal(canon[1], CANON);
  const ogUrl = HTML.match(/<meta property="og:url" content="([^"]+)">/);
  assert.ok(ogUrl, 'og:url must be present');
  assert.equal(canon[1], ogUrl[1], 'canonical must match og:url');
});

test('robots meta allows indexing', () => {
  const robots = HTML.match(/<meta name="robots" content="([^"]+)">/);
  assert.ok(robots, 'robots meta must be present');
  assert.match(robots[1], /index/);
  assert.match(robots[1], /follow/);
  assert.doesNotMatch(robots[1], /noindex/);
});

test('Open Graph has site_name, locale, and image:alt', () => {
  assert.match(HTML, /<meta property="og:site_name" content="[^"]+">/);
  assert.match(HTML, /<meta property="og:locale" content="en_US">/);
  assert.match(HTML, /<meta property="og:image:alt" content="[^"]+">/);
});

test('JSON-LD structured data is valid JSON with WebSite + WebApplication + Organization', () => {
  const m = HTML.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'JSON-LD script must be present');
  let data;
  assert.doesNotThrow(() => { data = JSON.parse(m[1]); }, 'JSON-LD must be valid JSON');
  assert.equal(data['@context'], 'https://schema.org');
  const types = (data['@graph'] || []).map(x => x['@type']);
  for (const t of ['WebSite', 'WebApplication', 'Organization']) {
    assert.ok(types.includes(t), `JSON-LD @graph must include ${t}`);
  }
  // the app node must be free + educational (rich-result signals)
  const app = data['@graph'].find(x => x['@type'] === 'WebApplication');
  assert.equal(app.applicationCategory, 'EducationalApplication');
  assert.equal(app.offers.price, '0');
  assert.equal(app.isAccessibleForFree, true);
});

test('public/robots.txt exists, allows crawl, and references the sitemap', () => {
  const p = join(ROOT, 'public', 'robots.txt');
  assert.ok(existsSync(p), 'public/robots.txt must exist');
  const txt = readFileSync(p, 'utf8');
  assert.match(txt, /User-agent:\s*\*/);
  assert.match(txt, /Allow:\s*\//);
  assert.match(txt, new RegExp('Sitemap:\\s*' + CANON + 'sitemap\\.xml'));
});

test('public/sitemap.xml exists, is a valid urlset, and lists the canonical home + /stories', () => {
  const p = join(ROOT, 'public', 'sitemap.xml');
  assert.ok(existsSync(p), 'public/sitemap.xml must exist');
  const xml = readFileSync(p, 'utf8');
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, new RegExp('<loc>' + CANON + '</loc>'));
  assert.match(xml, new RegExp('<loc>' + CANON + 'stories</loc>'), 'sitemap should list the stories hub');
  const locCount = (xml.match(/<loc>/g) || []).length;
  assert.ok(locCount >= 50, `sitemap should list the prerendered story pages (found ${locCount} URLs)`);
});

// ─── Prerendered crawlable story pages (the ranking lever) ───────────────────

test('server.js serves /stories + /stories/:slug with path-validated slug', () => {
  const srv = readFileSync(join(ROOT, 'server.js'), 'utf8');
  assert.match(srv, /app\.get\('\/stories',/, 'must serve the /stories hub');
  assert.match(srv, /app\.get\('\/stories\/:slug',/, 'must serve /stories/:slug');
  assert.match(srv, /\/\^\[a-z0-9-\]\+\$\/\.test\(slug\)/, 'slug must be path-validated (traversal guard)');
});

test('Coach: /stories routes are registered BEFORE express.static(public)', () => {
  // Otherwise express.static directory-redirects /stories → /stories/ (301) and
  // intercepts the clean URLs (the smoke bug). Routes must win.
  const srv = readFileSync(join(ROOT, 'server.js'), 'utf8');
  const iRoute = srv.indexOf("app.get('/stories'");
  const iStatic = srv.indexOf("express.static(path.join(__dirname, 'public')");
  assert.ok(iRoute !== -1 && iStatic !== -1, 'both the /stories route and the public static mount must exist');
  assert.ok(iRoute < iStatic, '/stories routes MUST come before express.static(public)');
});

test('maat-reader.html has the ?story=<slug> deep-link handler', () => {
  assert.match(HTML, /URLSearchParams\(window\.location\.search\)\.get\('story'\)/);
  assert.match(HTML, /STORIES\.findIndex\(s => s && s\.id === slug\)/);
  assert.match(HTML, /\[deeplink\]/, 'deep-link must log under a [deeplink] tag (Rule 1)');
});

test('prerender script exists, targets the perankh origin, parses via node:vm, and dry-runs cleanly', () => {
  const script = join(ROOT, 'scripts', 'prerender-stories.mjs');
  assert.ok(existsSync(script), 'scripts/prerender-stories.mjs must exist');
  const src = readFileSync(script, 'utf8');
  assert.match(src, /const ORIGIN = 'https:\/\/perankh\.osiriscare\.net'/, 'prerender must use the perankh canonical origin');
  assert.match(src, /vm\.runInNewContext/, 'prerender must parse via node:vm (isolated), not arbitrary code execution');
  const out = execFileSync('node', [script, '--dry-run'], { cwd: ROOT, encoding: 'utf8', timeout: 30000 });
  assert.match(out, /eligible \(chunk-having, non-battle\)/, 'dry-run must parse stories and report eligibility');
});
