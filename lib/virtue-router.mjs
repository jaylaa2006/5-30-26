// Adaptive virtue router for Maat dilemmas (Slice 4).
//
// Pure selection logic: given a dilemma pool tagged with virtues, the child's
// virtueProgress counters, and the current story's principle, pick which
// dilemma to surface at the next checkpoint.
//
// Priority order (a "living doctrine" for Sebas):
//   1. Story-principle override — 30% of the time, mirror the story's own
//      virtue so the dilemma reinforces the narrative frame.
//   2. Untested virtues — any virtue the child has never demonstrated
//      (virtueProgress[v] === 0 or missing). Random among untested.
//   3. Weakest tested virtue — lowest non-zero count. Random among ties.
//   4. Rotation fallback — round-robin by checkIdx.
//
// recentTexts (optional) — list of dilemma `text`s already shown in the
// current session. Used to avoid back-to-back repeats across stories. Router
// prefers unseen dilemmas within the target virtue but falls back to the full
// set when all candidates are in `recentTexts` (so selection never fails).
//
// Exports:
//   selectDilemma(pool, virtueProgress, storyPrinciple, checkIdx, rng, recentTexts)
//   Returns { dilemma, targetVirtue, strategy }.
//   principleToVirtue(label) — maps rich labels like "Care & Responsibility"
//   to one of the 7 canonical virtues, or null when unmappable.

export const ALL_VIRTUES = [
  'Truth','Justice','Propriety','Harmony','Balance','Reciprocity','RighteousOrder'
];

const STORY_PRINCIPLE_OVERRIDE_PROB = 0.3;

// Token → canonical virtue. First matching token in a label wins, so the
// primary theme (usually listed first) dominates. Synonyms cover every unique
// `story.principle` value currently in maat-reader.html (see tests).
const VIRTUE_SYNONYMS = {
  // Canonical virtue names
  truth:'Truth', justice:'Justice', propriety:'Propriety',
  harmony:'Harmony', balance:'Balance', reciprocity:'Reciprocity',
  righteous:'RighteousOrder', righteousness:'RighteousOrder',
  righteousorder:'RighteousOrder',

  // Truth family — honesty, integrity, preservation of truth
  integrity:'Truth', honesty:'Truth', honor:'Truth',
  preservation:'Truth', memory:'Truth',

  // Justice family — fairness, compassion-in-judgment, accountability
  compassion:'Justice', mercy:'Justice', fairness:'Justice',
  accountability:'Justice', law:'Justice', impartiality:'Justice',
  isfet:'Justice', verdict:'Justice', exploitation:'Justice',

  // Propriety family — proper conduct, discipline, craftsmanship, learning
  discipline:'Propriety', patience:'Propriety', craft:'Propriety',
  craftsmanship:'Propriety', learning:'Propriety',
  knowledge:'Propriety', innovation:'Propriety',

  // Harmony family — unity, community, connection
  unity:'Harmony', community:'Harmony', connection:'Harmony',
  collective:'Harmony',

  // Balance family — cosmic order, fair exchange, healing, transformation
  cosmic:'Balance', fair:'Balance', exchange:'Balance',
  transformation:'Balance', healing:'Balance', purification:'Balance',

  // Reciprocity family — generosity, care, gratitude, kinship
  generosity:'Reciprocity', care:'Reciprocity', responsibility:'Reciprocity',
  forgiveness:'Reciprocity', love:'Reciprocity', environmental:'Reciprocity',
  ancestral:'Reciprocity', trust:'Reciprocity', wealth:'Reciprocity',
  hospitality:'Reciprocity', family:'Reciprocity', daily:'Reciprocity',
  gratitude:'Reciprocity',

  // RighteousOrder family — sovereignty, leadership, wisdom, duty to order
  sovereignty:'RighteousOrder', governance:'RighteousOrder',
  leadership:'RighteousOrder', wisdom:'RighteousOrder',
  courage:'RighteousOrder', purpose:'RighteousOrder',
  perseverance:'RighteousOrder', power:'RighteousOrder',
  discernment:'RighteousOrder', heka:'RighteousOrder',
  restoration:'RighteousOrder', legacy:'RighteousOrder',
  sanctuary:'RighteousOrder', consequence:'RighteousOrder',
  foresight:'RighteousOrder', resurrection:'RighteousOrder',
  protection:'RighteousOrder', vigilance:'RighteousOrder',
  strategic:'RighteousOrder', order:'RighteousOrder',
  succession:'RighteousOrder', tyranny:'RighteousOrder',
  destiny:'RighteousOrder', elevation:'RighteousOrder',
  duty:'RighteousOrder', loyalty:'RighteousOrder',
  commitment:'RighteousOrder',
};

// Map a story principle (rich label or canonical) to one of the 7 virtues.
// Returns null when no token matches and no `maat` fallback applies.
export function principleToVirtue(label){
  if(typeof label !== 'string' || !label.trim()) return null;
  // Strip "Maat:" prefix so it doesn't dominate the token match.
  let clean = label.toLowerCase().replace(/^\s*maat\s*:/, '');
  clean = clean.replace(/['']/g, '').replace(/[—–-]/g, ' ');
  const tokens = clean.split(/[^a-z]+/).filter(Boolean);
  for(const token of tokens){
    if(VIRTUE_SYNONYMS[token]) return VIRTUE_SYNONYMS[token];
  }
  // Fallback: "All Principles of Maat", "Daily Maat" etc. with no specific token.
  if(/\bmaat\b/.test(clean)) return 'RighteousOrder';
  return null;
}

function normalizeVirtue(v){
  // A virtue string might already be canonical ("Truth") or a rich label
  // ("Care & Responsibility"). Canonicalize via principleToVirtue when the
  // raw string is not one of the 7, else strip whitespace for lookup.
  if(typeof v !== 'string') return '';
  const stripped = v.replace(/\s+/g,'');
  if(ALL_VIRTUES.includes(stripped)) return stripped;
  return principleToVirtue(v) || stripped;
}

function pickRandom(arr, rng){
  if(!arr.length) return null;
  const r = typeof rng === 'function' ? rng() : Math.random();
  return arr[Math.floor(r * arr.length)];
}

function firstMatchingDilemma(pool, virtue){
  if(!virtue) return null;
  return pool.find(d => normalizeVirtue(d.virtue) === virtue) || null;
}

function allMatchingDilemmas(pool, virtue){
  if(!virtue) return [];
  return pool.filter(d => normalizeVirtue(d.virtue) === virtue);
}

// Prefer unseen dilemmas for this virtue. Fall back to the full set when
// every candidate is in `recent` so selection never fails on a pool exhausted
// of fresh options. v3.43.4 — renamed from preferFresh() for semantic clarity:
// the contrast with `freshOnly()` (no fallback) is now explicit at call site.
function freshOrFallback(allForVirtue, recent){
  if(!allForVirtue.length) return allForVirtue;
  if(!recent || !recent.size) return allForVirtue;
  const fresh = allForVirtue.filter(d => !recent.has(d.text));
  return fresh.length ? fresh : allForVirtue;
}

// v3.43.3 — true freshness check (NO fallback to allForVirtue). Used by the
// untested/weakest selection branches to filter out exhausted virtues
// BEFORE picking; that prevents the single-dilemma-virtue loop where a
// pool of size 1 with its only dilemma already in `recent` would otherwise
// be returned via the freshOrFallback() fallback path.
function freshOnly(allForVirtue, recent){
  if(!allForVirtue.length) return allForVirtue;
  if(!recent || !recent.size) return allForVirtue;
  return allForVirtue.filter(d => !recent.has(d.text));
}

export function virtuesCoveredByPool(pool){
  const set = new Set();
  for(const d of (pool || [])){
    const v = normalizeVirtue(d.virtue);
    if(v) set.add(v);
  }
  return [...set];
}

export function selectDilemma(pool, virtueProgress, storyPrinciple, checkIdx, rng, recentTexts){
  if(!Array.isArray(pool) || pool.length === 0){
    return { dilemma: null, targetVirtue: null, strategy: 'empty' };
  }

  const vp = virtueProgress || {};
  const covered = virtuesCoveredByPool(pool);
  const recent = new Set(Array.isArray(recentTexts) ? recentTexts : []);

  // 1. Story-principle override (30% of the time).
  const principle = normalizeVirtue(storyPrinciple);
  if(principle && covered.includes(principle)){
    const r = typeof rng === 'function' ? rng() : Math.random();
    if(r < STORY_PRINCIPLE_OVERRIDE_PROB){
      const candidates = freshOrFallback(allMatchingDilemmas(pool, principle), recent);
      const dilemma = pickRandom(candidates, rng);
      if(dilemma){
        return { dilemma, targetVirtue: principle, strategy: 'story_principle' };
      }
    }
  }

  // 2. Untested virtues — any virtue in the pool the child has never shown.
  // v3.43.3 — only consider untested virtues whose pool isn't exhausted in
  // `recent`. If every untested virtue is exhausted, fall through to weakest.
  const untestedAll = covered.filter(v => !vp[v] || vp[v] === 0);
  if(untestedAll.length){
    const untestedUnexhausted = untestedAll.filter(v => freshOnly(allMatchingDilemmas(pool, v), recent).length > 0);
    if(untestedUnexhausted.length){
      const virtue = pickRandom(untestedUnexhausted, rng);
      const candidates = freshOnly(allMatchingDilemmas(pool, virtue), recent);
      const dilemma = pickRandom(candidates, rng);
      if(dilemma){
        return { dilemma, targetVirtue: virtue, strategy: 'untested' };
      }
    }
    // Otherwise: fall through (don't repeat-show; let weakest/rotation handle).
  }

  // 3. Weakest tested virtue — lowest non-zero count covered by the pool.
  // Same exhaustion guard as untested (v3.43.3).
  const tested = covered.filter(v => vp[v] > 0);
  if(tested.length){
    let minCount = Infinity;
    for(const v of tested){
      if(vp[v] < minCount) minCount = vp[v];
    }
    const weakest = tested.filter(v => vp[v] === minCount);
    const weakestUnexhausted = weakest.filter(v => freshOnly(allMatchingDilemmas(pool, v), recent).length > 0);
    if(weakestUnexhausted.length){
      const virtue = pickRandom(weakestUnexhausted, rng);
      const candidates = freshOnly(allMatchingDilemmas(pool, virtue), recent);
      const dilemma = pickRandom(candidates, rng);
      if(dilemma){
        return { dilemma, targetVirtue: virtue, strategy: 'weakest' };
      }
    }
  }

  // 3b. Last-resort fresh — pick ANY dilemma not in recent, ignoring virtue
  // priority. v3.43.3 — only reachable when at least one virtue branch was
  // entered AND exhausted. For untagged pools (covered.length === 0), skip
  // straight to rotation so the deterministic checkIdx contract holds.
  if(covered.length){
    const allUnexhausted = pool.filter(d => !recent.has(d.text));
    if(allUnexhausted.length){
      const dilemma = pickRandom(allUnexhausted, rng);
      return { dilemma, targetVirtue: normalizeVirtue(dilemma.virtue) || null, strategy: 'any_fresh' };
    }
  }

  // 4. Rotation fallback — round-robin through the pool by checkIdx.
  const idx = ((typeof checkIdx === 'number' ? checkIdx : 0) % pool.length + pool.length) % pool.length;
  const dilemma = pool[idx];
  return {
    dilemma,
    targetVirtue: normalizeVirtue(dilemma.virtue) || null,
    strategy: 'rotation',
  };
}
