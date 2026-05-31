#!/usr/bin/env node
/**
 * prerender-stories.mjs — SEO prerendering (v3.51.69).
 *
 * The reader is a single-page app: all 200+ stories live in a JS array and are
 * painted by JS, so crawlers see ONE thin page and there are no per-story URLs.
 * This script emits a static, crawlable HTML page per story at
 *   public/stories/<slug>.html  → served at /stories/<slug>
 * plus a hub index at public/stories/index.html → /stories
 * plus a full public/sitemap.xml listing every story URL.
 *
 * Each page carries the REAL story text (all chunks), the chunk-0 illustration,
 * per-page <title>/description/canonical/OG, Article + BreadcrumbList JSON-LD,
 * internal links (crawl graph), and a CTA into the interactive app
 * (/?story=<slug>). These are the indexable long-tail pages that rank.
 *
 * Generated HTML is gitignored (deploy-only, like art/); this SCRIPT is the
 * source of truth. Run before deploy, then rsync public/stories + public/sitemap.xml.
 *
 * Usage: node scripts/prerender-stories.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ORIGIN = 'https://perankh.osiriscare.net';
const OUT_DIR = join(ROOT, 'public', 'stories');
const ART_DIR = join(ROOT, 'art');
const DRY = process.argv.includes('--dry-run');

// ── Parse STORIES out of maat-reader.html ──
// The STORIES literal is JS (curly quotes, single quotes) — not JSON — so it
// can't be JSON.parse'd. Evaluate the array literal in an ISOLATED vm context
// (no require/process/fs access) rather than eval(): safer, and the file is a
// trusted in-repo build input.
function loadStories() {
  // STORIES was extracted to public/js/stories.js for perf (2026-05-23); parse it there.
  const src = readFileSync(join(ROOT, 'public', 'js', 'stories.js'), 'utf8');
  const s = src.indexOf('var STORIES = [');
  const a = src.indexOf('[', s);
  const e = src.indexOf('\n];', s);
  return vm.runInNewContext('(' + src.slice(a, e + 2) + ')', Object.create(null), { timeout: 5000 });
}

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function clean(str) { return String(str == null ? '' : str).replace(/\s+/g, ' ').trim(); }
// Coach C6 — JSON-LD lives inside <script>; JSON.stringify escapes quotes but NOT
// `<`, so a title containing "</script>" or "<" could break out. Escape every `<`.
function ld(obj) { return JSON.stringify(obj).replace(/</g, '\\u003c'); }

function synopsis(story, max = 155) {
  const t = clean(story.chunks && story.chunks[0] && story.chunks[0].text);
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
}

function hasArt(slug, n) {
  return existsSync(join(ART_DIR, slug, `chunk-${n}.png`));
}

// ── Page template ──────────────────────────────────────────────────────────
function renderStoryPage(story, siblings) {
  const slug = story.id;
  const url = `${ORIGIN}/stories/${slug}`;
  const title = clean(story.title) || slug;
  const desc = synopsis(story);
  const principle = clean(story.principle);
  const grade = story.grade;
  const heroImg = hasArt(slug, 0) ? `${ORIGIN}/art/${slug}/chunk-0.png` : `${ORIGIN}/og-image.png`;

  const chunksHtml = (story.chunks || []).map((c, i) => {
    const img = hasArt(slug, i)
      ? `<img class="ch-img" src="/art/${slug}/chunk-${i}.png" alt="${esc(title)} — illustration ${i + 1}" loading="lazy" width="800" height="450">`
      : '';
    return `${img}<p>${esc(clean(c.text))}</p>`;
  }).join('\n');

  // Coach C3 — prefer same-scene siblings, then pad with others, so EVERY page
  // gets a full crawl-graph (no empty "More stories" on a unique-scene story).
  const sameScene = siblings.filter(s => s.id !== slug && s.scene === story.scene);
  const otherScene = siblings.filter(s => s.id !== slug && s.scene !== story.scene);
  const related = [...sameScene, ...otherScene].slice(0, 6)
    .map(s => `<li><a href="/stories/${s.id}">${esc(clean(s.title))}</a></li>`).join('\n');

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': ['Article', 'CreativeWork'],
    headline: title,
    description: desc,
    image: heroImg,
    inLanguage: 'en',
    url,
    isPartOf: { '@type': 'WebSite', '@id': `${ORIGIN}/#website`, name: 'Per Ankh Reader — House of Life' },
    publisher: { '@type': 'Organization', '@id': `${ORIGIN}/#org`, name: 'Per Ankh Reader' },
    educationalUse: 'reading comprehension; moral education; history',
    learningResourceType: 'illustrated story',
    audience: { '@type': 'EducationalAudience', educationalRole: 'student' },
    about: ['African history', 'Ancient Kemet', principle].filter(Boolean),
    isAccessibleForFree: true
  };
  if (grade) articleLd.typicalAgeRange = `${Math.max(4, grade + 1)}-${grade + 2}`;

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Stories', item: `${ORIGIN}/stories` },
      { '@type': 'ListItem', position: 3, name: title, item: url }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — Per Ankh Reader</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)} — Per Ankh Reader">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${heroImg}">
<meta property="og:site_name" content="Per Ankh Reader — House of Life">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)} — Per Ankh Reader">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${heroImg}">
<script type="application/ld+json">${ld(articleLd)}</script>
<script type="application/ld+json">${ld(breadcrumbLd)}</script>
<style>
:root{--gold:#C4A347;--gold-bright:#FFD166;--bg:#110D08;--cream:#F2E4CC}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--cream);font-family:Georgia,'Times New Roman',serif;line-height:1.7}
.wrap{max-width:760px;margin:0 auto;padding:24px 20px 64px}
nav.crumb{font-size:.85rem;color:#b9a87f;margin-bottom:18px}
nav.crumb a{color:var(--gold);text-decoration:none}
h1{color:var(--gold-bright);font-size:2rem;line-height:1.2;margin:.2em 0}
.meta{color:#b9a87f;font-size:.9rem;margin-bottom:8px}
.principle{color:var(--gold);font-size:1.05rem;margin:0 0 24px}
.cta{display:inline-block;background:var(--gold);color:#1a1208;font-weight:bold;text-decoration:none;
  padding:12px 26px;border-radius:24px;margin:8px 0 28px;font-family:system-ui,sans-serif}
.ch-img{width:100%;height:auto;border-radius:10px;margin:22px 0 6px;display:block}
p{margin:0 0 18px;font-size:1.08rem}
.related{margin-top:48px;border-top:1px solid #3a3122;padding-top:20px}
.related h2{color:var(--gold-bright);font-size:1.2rem}
.related ul{list-style:none;padding:0}
.related li{margin:8px 0}
.related a{color:var(--gold);text-decoration:none}
footer{margin-top:40px;color:#8a7c5c;font-size:.85rem}
footer a{color:var(--gold)}
</style>
</head>
<body>
<main class="wrap">
<nav class="crumb"><a href="/">Per Ankh Reader</a> › <a href="/stories">Stories</a> › ${esc(title)}</nav>
<h1>${esc(title)}</h1>
<div class="meta">An illustrated story from the Per Ankh Reader${grade ? ` · Reading level: grade ${esc(grade)}` : ''}</div>
${principle ? `<p class="principle">Theme: ${esc(principle)}</p>` : ''}
<a class="cta" href="/?story=${esc(slug)}">▶ Read the interactive, narrated version</a>
<article>
${chunksHtml}
</article>
<a class="cta" href="/?story=${esc(slug)}">▶ Open this story in the Per Ankh Reader</a>
<section class="related">
<h2>More stories</h2>
<ul>
${related}
</ul>
<p><a href="/stories">Browse all stories →</a></p>
</section>
<footer>
<p>Per Ankh Reader — free illustrated African &amp; Kemetic history stories for children, rooted in Maat. <a href="/">Explore the full library →</a></p>
</footer>
</main>
</body>
</html>
`;
}

function renderIndexPage(stories) {
  const url = `${ORIGIN}/stories`;
  const items = stories.map(s =>
    `<li><a href="/stories/${s.id}">${esc(clean(s.title))}</a>${s.principle ? ` <span class="p">— ${esc(clean(s.principle))}</span>` : ''}</li>`
  ).join('\n');
  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    url,
    name: 'All Stories — Per Ankh Reader',
    description: `${stories.length}+ free illustrated African and Kemetic history stories for children ages 5-14, rooted in Maat.`,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', '@id': `${ORIGIN}/#website` }
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>All Stories — Per Ankh Reader (African &amp; Kemetic history for kids)</title>
<meta name="description" content="Browse ${stories.length}+ free illustrated African and Kemetic history stories for children ages 5-14, rooted in Maat — Ancient Kemet, Nubia, Kush, and more.">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="All Stories — Per Ankh Reader">
<meta property="og:description" content="${stories.length}+ free illustrated African &amp; Kemetic history stories for children, rooted in Maat.">
<meta property="og:image" content="${ORIGIN}/og-image.png">
<meta property="og:site_name" content="Per Ankh Reader — House of Life">
<script type="application/ld+json">${ld(collectionLd)}</script>
<style>
body{margin:0;background:#110D08;color:#F2E4CC;font-family:Georgia,serif;line-height:1.6}
.wrap{max-width:820px;margin:0 auto;padding:28px 20px 64px}
h1{color:#FFD166;font-size:2rem}
.lead{color:#cbbd97;font-size:1.05rem;margin-bottom:24px}
ul{list-style:none;padding:0;columns:2;column-gap:32px}
@media(max-width:600px){ul{columns:1}}
li{margin:0 0 12px;break-inside:avoid}
a{color:#C4A347;text-decoration:none}
.p{color:#8a7c5c;font-size:.85rem}
footer{margin-top:40px;color:#8a7c5c;font-size:.85rem}
</style>
</head>
<body>
<main class="wrap">
<nav style="font-size:.85rem;margin-bottom:16px"><a href="/">Per Ankh Reader</a> › Stories</nav>
<h1>All Stories</h1>
<p class="lead">${stories.length} free illustrated stories of African &amp; Kemetic history for children ages 5-14, each rooted in Maat. Read them here, or open the interactive narrated library.</p>
<ul>
${items}
</ul>
<footer><p><a href="/">← Back to the Per Ankh Reader library</a></p></footer>
</main>
</body>
</html>
`;
}

function renderSitemap(stories) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${ORIGIN}/`, pri: '1.0', freq: 'weekly' },
    { loc: `${ORIGIN}/stories`, pri: '0.9', freq: 'weekly' },
    ...stories.map(s => ({ loc: `${ORIGIN}/stories/${s.id}`, pri: '0.7', freq: 'monthly' }))
  ];
  const body = urls.map(u =>
    `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.pri}</priority>\n  </url>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

// ── Run ──────────────────────────────────────────────────────────────────
const all = loadStories();
const stories = all.filter(s => s && s.id && Array.isArray(s.chunks) && s.chunks.length > 0 && s.scene !== 'scene-battle');
console.log(`[prerender] ${all.length} stories parsed; ${stories.length} eligible (chunk-having, non-battle)`);

if (DRY) {
  console.log('[prerender] DRY RUN — sample page head for', stories[0].id, '\n');
  console.log(renderStoryPage(stories[0], stories).slice(0, 700));
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
let written = 0;
for (const story of stories) {
  writeFileSync(join(OUT_DIR, `${story.id}.html`), renderStoryPage(story, stories));
  written++;
}
writeFileSync(join(OUT_DIR, 'index.html'), renderIndexPage(stories));
writeFileSync(join(ROOT, 'public', 'sitemap.xml'), renderSitemap(stories));
console.log(`[prerender] wrote ${written} story pages + index.html + sitemap.xml (${stories.length + 2} URLs)`);
