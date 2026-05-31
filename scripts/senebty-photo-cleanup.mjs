// Daily cleanup for F5 PHOTO_IRI. Walks PHOTOS_ROOT, deletes *.enc older
// than 30 days. Logs structured JSON. PM2-cron-scheduled at 03:00.
//
// Standalone: node scripts/senebty-photo-cleanup.mjs
// Programmatic: import { runCleanup } from './scripts/senebty-photo-cleanup.mjs'

import fs from 'node:fs/promises';
import path from 'node:path';

export async function runCleanup({ rootDir, ttlDays = 30 }) {
  const cutoff = Date.now() - ttlDays * 86400 * 1000;
  const summary = { date: new Date().toISOString(), scanned: 0, deleted_30d: 0, deleted_orphans: 0, errors: [] };

  async function walk(dir) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch (e) { if (e.code !== 'ENOENT') summary.errors.push({ dir, code: e.code, msg: e.message }); return; }
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(p);
      else if (ent.name.endsWith('.enc')) {
        summary.scanned++;
        try {
          const stat = await fs.stat(p);
          if (stat.mtimeMs < cutoff) {
            await fs.unlink(p);
            summary.deleted_30d++;
          }
        } catch (e) {
          summary.errors.push({ file: p, code: e.code, msg: e.message });
        }
      }
    }
  }

  await walk(rootDir);
  return summary;
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const rootDir = process.env.PHOTOS_ROOT || '/var/www/perankh/photos';
  const summary = await runCleanup({ rootDir, ttlDays: 30 });
  console.log(JSON.stringify(summary));
}
