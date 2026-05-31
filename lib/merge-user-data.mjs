// Monotonic deep-merge for the cloud `user_data` blob (/api/seba-sync).
//
// Background (v3.51.x sync-reliability audit): the sync used to BLIND-OVERWRITE
// the stored blob with whatever the client pushed. Combined with a 30s client
// debounce that was cleared (not flushed) on tab-close, the SQLite cloud copy
// stayed stuck at each child's first-save snapshot — so storyTimes / storiesRead
// / grade never accumulated, and a stale or fresh-device client could clobber a
// child's accumulated cloud progress.
//
// This merge makes every sync ADDITIVE for accumulated progress while keeping
// last-write-wins for mutable state (lockout, settings, prefs). Accumulated
// fields can never regress; a null/absent grade never wipes a known grade. An
// explicit `resetProgress` flag bypasses the guards for legitimate resets.
//
// Pure + dependency-free so it can be unit-tested without booting the API.

export function _num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
export function _isPlainObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

// Richer of two arrays: union for primitives, longer for object arrays.
export function unionArray(a, b) {
  const A = Array.isArray(a) ? a : [], B = Array.isArray(b) ? b : [];
  if (!A.length) return B;
  if (!B.length) return A;
  const allPrim = [...A, ...B].every(x => x === null || typeof x !== 'object');
  if (allPrim) return [...new Set([...A, ...B])];
  return B.length >= A.length ? B : A;
}

// Keep the larger number, the richer array, or the present value.
export function maxNumOrRicher(a, b) {
  const an = _num(a), bn = _num(b);
  if (an !== null && bn !== null) return Math.max(an, bn);
  if (Array.isArray(a) || Array.isArray(b)) return unionArray(a, b);
  return (b != null ? b : a);
}

// Per-key map keeping the max numeric value (best score per chunk/story).
export function mergeMaxMap(a, b) {
  const A = _isPlainObj(a) ? a : {}, B = _isPlainObj(b) ? b : {};
  const out = { ...A };
  for (const k of Object.keys(B)) {
    const av = A[k], bv = B[k];
    out[k] = (typeof av === 'number' && typeof bv === 'number') ? Math.max(av, bv) : bv;
  }
  return out;
}

// storyTimes: { storyId: [ {session}, ... ] } — keep the richer history per story.
export function mergeStoryTimes(a, b) {
  const A = _isPlainObj(a) ? a : {}, B = _isPlainObj(b) ? b : {};
  const out = { ...A };
  for (const k of Object.keys(B)) {
    const av = Array.isArray(A[k]) ? A[k] : [], bv = Array.isArray(B[k]) ? B[k] : [];
    out[k] = bv.length >= av.length ? bv : av;
  }
  return out;
}

export function mergeUserData(existing, incoming) {
  // capLogArrays on every return path — a brand-new user or a wholesale reset
  // must also land within the blob ceiling, not just the normal merge path.
  if (!_isPlainObj(existing)) return capLogArrays(incoming);
  if (!_isPlainObj(incoming)) return capLogArrays(existing);
  if (incoming.resetProgress === true) return capLogArrays(incoming); // explicit reset wins wholesale

  const out = { ...existing, ...incoming }; // last-write-wins baseline
  // Accumulated-progress fields: never regress.
  out.wordsRead   = maxNumOrRicher(existing.wordsRead, incoming.wordsRead);
  out.ankhs       = maxNumOrRicher(existing.ankhs, incoming.ankhs);
  out.scarabs     = maxNumOrRicher(existing.scarabs, incoming.scarabs);
  out.powerWords  = maxNumOrRicher(existing.powerWords, incoming.powerWords);
  out.storiesRead = unionArray(existing.storiesRead, incoming.storiesRead);
  out.storyTimes  = mergeStoryTimes(existing.storyTimes, incoming.storyTimes);
  out.scores           = mergeMaxMap(existing.scores, incoming.scores);
  out.checkpointScores = mergeMaxMap(existing.checkpointScores, incoming.checkpointScores);
  // A null/absent grade must never wipe a grade we already know.
  if ((incoming.grade === null || incoming.grade === undefined) && existing.grade != null) {
    out.grade = existing.grade;
  }
  // Cap unbounded NON-analytics log arrays so the blob can't grow without bound
  // and eventually 413 the sync (re-creating the capture gap). storyTimes /
  // storiesRead / scores are deliberately NOT capped — they are analytics-
  // critical. Only flat append-only logs are trimmed to their most-recent tail.
  capLogArrays(out);
  return out;
}

export const LOG_ARRAY_CAP = 500;
const LOG_ARRAY_FIELDS = ['responseLog', 'maatReflectionHistory', 'maatReflections', 'questionHistory'];
export function capLogArrays(o) {
  if (!_isPlainObj(o)) return o;
  for (const f of LOG_ARRAY_FIELDS) {
    if (Array.isArray(o[f]) && o[f].length > LOG_ARRAY_CAP) {
      o[f] = o[f].slice(-LOG_ARRAY_CAP);
    }
  }
  return o;
}
