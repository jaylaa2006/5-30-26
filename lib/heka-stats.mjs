// Heka recognition stats — pure aggregator over [HEKA-TEL] log lines.
// Extracted for unit testing. Imported by seba-story-api.mjs.

import fs from 'fs';

const HEKA_TAIL_BYTES = 512 * 1024;

export function percentile(sortedArr, p){
  if(!sortedArr.length) return null;
  const idx = Math.min(sortedArr.length - 1, Math.floor(sortedArr.length * p));
  return sortedArr[idx];
}

export function tailLog(filePath, maxLines){
  const stat = fs.statSync(filePath);
  const start = Math.max(0, stat.size - HEKA_TAIL_BYTES);
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    const lines = buf.toString('utf8').split('\n');
    return lines.slice(-maxLines);
  } finally { fs.closeSync(fd); }
}

export function parseHekaEvents(lines){
  const events = [];
  for(const line of lines){
    const idx = line.indexOf('[HEKA-TEL]');
    if(idx < 0) continue;
    const json = line.slice(idx + '[HEKA-TEL]'.length).trim();
    try {
      const obj = JSON.parse(json);
      if(obj && obj.schema === 'v1') events.push(obj);
    } catch(e){ /* skip malformed */ }
  }
  return events;
}

export function summarizeEvents(events){
  const total = events.length;
  if(!total) return { total: 0, completion: {}, fallback: {}, region: {}, ua: {}, latency: {} };
  const completion = {}, fallback = {}, region = {}, ua = {};
  const interimMs = [], confirmMs = [];
  for(const e of events){
    completion[e.completion] = (completion[e.completion] || 0) + 1;
    fallback[e.fallback_used] = (fallback[e.fallback_used] || 0) + 1;
    const r = e.region || 'unknown';
    region[r] = (region[r] || 0) + 1;
    ua[e.ua_family || 'other'] = (ua[e.ua_family || 'other'] || 0) + 1;
    if(typeof e.first_interim_ms === 'number') interimMs.push(e.first_interim_ms);
    if(typeof e.first_confirm_ms === 'number') confirmMs.push(e.first_confirm_ms);
  }
  interimMs.sort((a,b) => a - b);
  confirmMs.sort((a,b) => a - b);
  return {
    total,
    completion, fallback, region, ua,
    latency: {
      first_interim_ms: {
        n: interimMs.length,
        p50: percentile(interimMs, 0.50),
        p95: percentile(interimMs, 0.95),
      },
      first_confirm_ms: {
        n: confirmMs.length,
        p50: percentile(confirmMs, 0.50),
        p95: percentile(confirmMs, 0.95),
      },
    },
  };
}

export function aggregateHekaStats(filePath, maxLines){
  let lines;
  try { lines = tailLog(filePath, maxLines); }
  catch(e){ return { error: 'log_unavailable', detail: e.code || e.message }; }
  return summarizeEvents(parseHekaEvents(lines));
}
