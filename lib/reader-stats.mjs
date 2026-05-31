// Reader recognition stats — pure aggregator over [READER-TEL] log lines.
// Extracted for unit testing. Imported by seba-story-api.mjs.
//
// Mirrors lib/heka-stats.mjs. Reader-specific extensions:
//   - `missed_ratio`  — overall missed / matched+missed across all events
//   - `circuit_open`  — count + ratio of events where Azure was skipped
//   - `listened_ms`   — p50/p95 of mic-active duration (separate signal
//                       from completed_ms because chunks can finish
//                       early via 'next' / 'cancelled')

import fs from 'fs';

const READER_TAIL_BYTES = 512 * 1024;

export function percentile(sortedArr, p){
  if(!sortedArr.length) return null;
  const idx = Math.min(sortedArr.length - 1, Math.floor(sortedArr.length * p));
  return sortedArr[idx];
}

export function tailLog(filePath, maxLines){
  const stat = fs.statSync(filePath);
  const start = Math.max(0, stat.size - READER_TAIL_BYTES);
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    const lines = buf.toString('utf8').split('\n');
    return lines.slice(-maxLines);
  } finally { fs.closeSync(fd); }
}

export function parseReaderEvents(lines){
  const events = [];
  for(const line of lines){
    const idx = line.indexOf('[READER-TEL]');
    if(idx < 0) continue;
    const json = line.slice(idx + '[READER-TEL]'.length).trim();
    try {
      const obj = JSON.parse(json);
      if(obj && obj.schema === 'v1') events.push(obj);
    } catch(e){ /* skip malformed */ }
  }
  return events;
}

export function summarizeEvents(events){
  const total = events.length;
  if(!total) return {
    total: 0, completion: {}, fallback: {}, region: {}, ua: {},
    circuit_open: { count: 0, ratio: null },
    accuracy: { matched: 0, missed: 0, ratio: null },
    latency: {},
  };
  const completion = {}, fallback = {}, region = {}, ua = {};
  const interimMs = [], confirmMs = [], completedMs = [], listenedMs = [];
  let totalMatched = 0, totalMissed = 0;
  let circuitOpenCount = 0;
  for(const e of events){
    completion[e.completion] = (completion[e.completion] || 0) + 1;
    fallback[e.fallback_used] = (fallback[e.fallback_used] || 0) + 1;
    const r = e.region || 'unknown';
    region[r] = (region[r] || 0) + 1;
    ua[e.ua_family || 'other'] = (ua[e.ua_family || 'other'] || 0) + 1;
    if(typeof e.first_interim_ms === 'number') interimMs.push(e.first_interim_ms);
    if(typeof e.first_confirm_ms === 'number') confirmMs.push(e.first_confirm_ms);
    if(typeof e.completed_ms === 'number')     completedMs.push(e.completed_ms);
    if(typeof e.listened_ms === 'number')      listenedMs.push(e.listened_ms);
    if(typeof e.matched === 'number') totalMatched += e.matched;
    if(typeof e.missed === 'number')  totalMissed  += e.missed;
    if(e.circuit_open === true) circuitOpenCount++;
  }
  interimMs.sort((a,b) => a - b);
  confirmMs.sort((a,b) => a - b);
  completedMs.sort((a,b) => a - b);
  listenedMs.sort((a,b) => a - b);
  const accuracyDenom = totalMatched + totalMissed;
  return {
    total,
    completion, fallback, region, ua,
    circuit_open: {
      count: circuitOpenCount,
      ratio: total > 0 ? circuitOpenCount / total : null,
    },
    accuracy: {
      matched: totalMatched,
      missed: totalMissed,
      ratio: accuracyDenom > 0 ? totalMatched / accuracyDenom : null,
    },
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
      completed_ms: {
        n: completedMs.length,
        p50: percentile(completedMs, 0.50),
        p95: percentile(completedMs, 0.95),
      },
      listened_ms: {
        n: listenedMs.length,
        p50: percentile(listenedMs, 0.50),
        p95: percentile(listenedMs, 0.95),
      },
    },
  };
}

export function aggregateReaderStats(filePath, maxLines){
  let lines;
  try { lines = tailLog(filePath, maxLines); }
  catch(e){ return { error: 'log_unavailable', detail: e.code || e.message }; }
  return summarizeEvents(parseReaderEvents(lines));
}
