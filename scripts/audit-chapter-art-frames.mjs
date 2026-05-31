#!/usr/bin/env node
// scripts/audit-chapter-art-frames.mjs
//
// Sweep every story dir under art/* and audit chunk-0.png (the rendered
// hero/card thumb) for baked-in white framing / pillarbox bars.
//
// Methodology:
//   - For each PNG, sample 4 edge strips: top 10px, bottom 10px,
//     left 10px, right 10px.
//   - Compute MEAN luminance of each strip (Rec. 709 weighted: Y =
//     0.2126*R + 0.7152*G + 0.0722*B).
//   - Flag PNGs where ANY edge strip mean luminance > 240/255 (WARN)
//     or > 248/255 (FAIL).
//
// Output:
//   - Pretty table to stdout.
//   - JSON sidecar to docs/superpowers/specs/2026-05-17-chapter-art-frame-audit.json
//   - Markdown findings written separately (see writer at bottom).
//
// Security: child_process spawn with args array, never shell concat.
// Project rule: never pass user input to shell — args array only.

import { spawn } from 'node:child_process';
import { readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const ART_DIR = path.join(REPO_ROOT, 'art');
const STRIP_PX = 10;
const WARN_LUM = 240;
const FAIL_LUM = 248;

// Inline Python program (passed to python3 via -c, args-array spawn).
// Reads a PNG path from stdin (one per line) and emits one JSON object
// per line with luminance stats. Single python process for all PNGs =
// avoids per-image interpreter spinup cost.
const PY_WORKER = `
import sys, json
from PIL import Image

STRIP = ${STRIP_PX}

def lum_strip(img, side):
    px = img.load()
    W, H = img.size
    total = 0.0
    count = 0
    if side == 'top':
        for y in range(0, min(STRIP, H)):
            for x in range(W):
                p = px[x, y]
                r, g, b = p[0], p[1], p[2]
                total += 0.2126*r + 0.7152*g + 0.0722*b
                count += 1
    elif side == 'bottom':
        for y in range(max(0, H-STRIP), H):
            for x in range(W):
                p = px[x, y]
                r, g, b = p[0], p[1], p[2]
                total += 0.2126*r + 0.7152*g + 0.0722*b
                count += 1
    elif side == 'left':
        for x in range(0, min(STRIP, W)):
            for y in range(H):
                p = px[x, y]
                r, g, b = p[0], p[1], p[2]
                total += 0.2126*r + 0.7152*g + 0.0722*b
                count += 1
    elif side == 'right':
        for x in range(max(0, W-STRIP), W):
            for y in range(H):
                p = px[x, y]
                r, g, b = p[0], p[1], p[2]
                total += 0.2126*r + 0.7152*g + 0.0722*b
                count += 1
    return total / count if count else 0.0

for line in sys.stdin:
    p = line.strip()
    if not p:
        continue
    try:
        img = Image.open(p).convert('RGB')
        W, H = img.size
        out = {
            'path': p,
            'width': W,
            'height': H,
            'top': round(lum_strip(img, 'top'), 2),
            'bottom': round(lum_strip(img, 'bottom'), 2),
            'left': round(lum_strip(img, 'left'), 2),
            'right': round(lum_strip(img, 'right'), 2),
        }
    except Exception as e:
        out = {'path': p, 'error': str(e)}
    sys.stdout.write(json.dumps(out) + '\\n')
    sys.stdout.flush()
`;

async function listStoryDirs() {
  const entries = await readdir(ART_DIR, { withFileTypes: true });
  const dirs = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    // Skip non-story buckets that don't follow the chunk-N.png pattern.
    // We still try them — only included if chunk-0.png exists.
    const chunk0 = path.join(ART_DIR, e.name, 'chunk-0.png');
    if (existsSync(chunk0)) dirs.push({ storyId: e.name, chunk0 });
  }
  dirs.sort((a, b) => a.storyId.localeCompare(b.storyId));
  return dirs;
}

function verdictFor(row) {
  const max = Math.max(row.top, row.bottom, row.left, row.right);
  if (max > FAIL_LUM) return 'FAIL';
  if (max > WARN_LUM) return 'WARN';
  return 'PASS';
}

async function runPython(paths) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', ['-c', PY_WORKER], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (b) => { stdout += b.toString('utf8'); });
    proc.stderr.on('data', (b) => { stderr += b.toString('utf8'); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`python3 exited ${code}: ${stderr}`));
      }
      const results = stdout
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l));
      resolve(results);
    });
    for (const p of paths) proc.stdin.write(p + '\n');
    proc.stdin.end();
  });
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

async function main() {
  const dirs = await listStoryDirs();
  console.log(`[audit] found ${dirs.length} story dirs with chunk-0.png`);
  console.log(`[audit] running luminance sweep (single python3 worker)...`);
  const t0 = Date.now();
  const raw = await runPython(dirs.map((d) => d.chunk0));
  const elapsedMs = Date.now() - t0;
  console.log(`[audit] sweep done in ${(elapsedMs / 1000).toFixed(1)}s`);

  // Join results back to story IDs.
  const byPath = new Map(raw.map((r) => [r.path, r]));
  const rows = dirs.map((d) => {
    const r = byPath.get(d.chunk0) || { error: 'no result' };
    if (r.error) {
      return { storyId: d.storyId, error: r.error, verdict: 'ERROR' };
    }
    const v = verdictFor(r);
    return {
      storyId: d.storyId,
      width: r.width,
      height: r.height,
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      verdict: v,
    };
  });

  // Pretty-print table.
  console.log('');
  console.log(
    pad('story-id', 50) +
      pad('top', 8) +
      pad('bot', 8) +
      pad('left', 8) +
      pad('right', 8) +
      'verdict',
  );
  console.log('-'.repeat(90));
  for (const row of rows) {
    if (row.error) {
      console.log(pad(row.storyId, 50) + 'ERROR: ' + row.error);
      continue;
    }
    console.log(
      pad(row.storyId, 50) +
        pad(row.top.toFixed(1), 8) +
        pad(row.bottom.toFixed(1), 8) +
        pad(row.left.toFixed(1), 8) +
        pad(row.right.toFixed(1), 8) +
        row.verdict,
    );
  }

  const counts = { PASS: 0, WARN: 0, FAIL: 0, ERROR: 0 };
  for (const r of rows) counts[r.verdict] = (counts[r.verdict] || 0) + 1;

  console.log('');
  console.log('[audit] summary');
  console.log(`  PASS:  ${counts.PASS}`);
  console.log(`  WARN:  ${counts.WARN}  (any edge mean lum > ${WARN_LUM}/255)`);
  console.log(`  FAIL:  ${counts.FAIL}  (any edge mean lum > ${FAIL_LUM}/255)`);
  console.log(`  ERROR: ${counts.ERROR}`);

  // Top-10 worst offenders by max edge luminance.
  const ranked = rows
    .filter((r) => !r.error)
    .map((r) => ({
      ...r,
      maxEdge: Math.max(r.top, r.bottom, r.left, r.right),
      whichEdge: [
        ['top', r.top],
        ['bottom', r.bottom],
        ['left', r.left],
        ['right', r.right],
      ].sort((a, b) => b[1] - a[1])[0][0],
    }))
    .sort((a, b) => b.maxEdge - a.maxEdge);
  const top10 = ranked.slice(0, 10);
  console.log('');
  console.log('[audit] top-10 worst offenders (by max edge mean luminance):');
  for (const r of top10) {
    console.log(
      `  ${pad(r.storyId, 50)} ${r.whichEdge.padEnd(7)} ${r.maxEdge.toFixed(1)}  ${r.verdict}`,
    );
  }

  // Write JSON sidecar for downstream tooling.
  const outDir = path.join(REPO_ROOT, 'docs', 'superpowers', 'specs');
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, '2026-05-17-chapter-art-frame-audit.json');
  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        warnThreshold: WARN_LUM,
        failThreshold: FAIL_LUM,
        stripPx: STRIP_PX,
        counts,
        rows,
        top10,
      },
      null,
      2,
    ),
  );
  console.log(`[audit] wrote ${jsonPath}`);

  return { rows, counts, top10 };
}

main().catch((e) => {
  console.error('[audit] fatal:', e);
  process.exit(1);
});
