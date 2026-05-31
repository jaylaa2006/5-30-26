// yt-dlp resolver validation (2026-05-20 error-sweep hardening).
// Locks the cached --version health-check added after a cold_start_failure on a
// present-but-non-executable candidate (apt /usr/bin/yt-dlp wrapper ENOENTs
// under PM2's stripped PATH). server.js boots on import → assert on source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.js', 'utf8');

test('spawnSync is imported for the validation probe', () => {
  assert.match(server, /const \{ spawn, spawnSync \} = require\('child_process'\)/);
});

test('resolver validates a candidate runs (--version) before committing', () => {
  assert.match(server, /function _ytDlpRuns\(p\)/, 'must have a _ytDlpRuns probe');
  assert.match(server, /spawnSync\(p, \['--version'\], \{ timeout: 5000, stdio: 'ignore' \}\)/,
    'probe must run --version with a timeout and no output leak');
  assert.match(server, /r\.status === 0/, 'probe must check exit status 0');
});

test('getYtDlpBin skips present-but-broken candidates and caches the validated path', () => {
  const fn = server.match(/function getYtDlpBin\(\)[\s\S]*?\n\}/);
  assert.ok(fn, 'getYtDlpBin must exist');
  assert.match(fn[0], /if \(!fs\.existsSync\(p\)\) continue;/, 'existence re-checked every call (removed binary falls through)');
  assert.match(fn[0], /if \(_ytDlpValidated === p\) return p;/, 'validated path is cached — no re-spawn');
  assert.match(fn[0], /if \(_ytDlpRuns\(p\)\)/, 'must validate before committing');
  assert.match(fn[0], /candidate exists but failed --version, skipping/, 'broken candidate is skipped, not used');
});
