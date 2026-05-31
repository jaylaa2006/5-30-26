import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

test('no _startElderHintTimer( callsites remain in maat-reader.html', () => {
  // Allow the function definition itself to remain (server-endpoint preserved
  // for rollback per spec) but ensure no caller invokes it.
  const callsites = html.match(/this\._startElderHintTimer\(/g) || [];
  assert.equal(callsites.length, 0, 'expected zero this._startElderHintTimer( call-sites; found ' + callsites.length);
});
