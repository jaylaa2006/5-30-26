// Server-side gate for /api/seba-evaluate (Slice 1 — rubric honesty fix).
//
// Problem: the Gemini rubric adds points additively (base 3 + virtues +
// bonuses), so a warm, well-formed response that does NOT engage the
// question can still score 5-6 if Gemini latches onto any virtue keyword.
// That inflation is the "King typed something that doesn't answer the
// question and still got high marks" bug.
//
// Fix: dual defense.
//   1. Prompt instructs Gemini to return `on_topic ∈ {yes, partially, no}`
//      and apply its own cap.
//   2. This server-side helper re-applies the cap AFTER Gemini responds so
//      a hallucinated high score is authoritatively clamped.
//
// Caps:
//   on_topic='no'        → score ≤ 3 (Seed/Sprout only)
//   on_topic='partially' → score ≤ 5 (Sapling ceiling)
//   on_topic='yes'       → no cap (full rubric applies)
//   sincerity='off-topic' is also treated as a hard cap (≤3) for legacy
//   payloads from cached responses predating the on_topic field.

export const TIER_BY_SCORE = [
  { max: 2,  name: 'Seed'    },
  { max: 4,  name: 'Sprout'  },
  { max: 6,  name: 'Sapling' },
  { max: 8,  name: 'Tree'    },
  { max: 10, name: 'Seba'    },
];

export function tierForScore(score){
  for (const t of TIER_BY_SCORE) if (score <= t.max) return t.name;
  return 'Seba';
}

export function normalizeOnTopic(raw){
  return ['yes','partially','no'].includes(raw) ? raw : null;
}

export function capForOnTopic(onTopic, sincerity){
  if (onTopic === 'no' || sincerity === 'off-topic') return 3;
  if (onTopic === 'partially') return 5;
  return 10;
}

// Pure. Takes an evaluation object (as returned by Gemini), returns a new
// object with {maatAlignment, tierName, on_topic} corrected. Other fields
// pass through untouched.
export function applyTopicGate(evaluation){
  if (!evaluation || typeof evaluation !== 'object') return evaluation;
  const parsed = parseInt(evaluation.maatAlignment, 10);
  let score = Number.isFinite(parsed) ? Math.min(10, Math.max(1, parsed)) : 5;
  const onTopic = normalizeOnTopic(evaluation.on_topic);
  const cap = capForOnTopic(onTopic, evaluation.sincerity);
  if (score > cap) score = cap;
  return {
    ...evaluation,
    maatAlignment: score,
    tierName: tierForScore(score),
    on_topic: onTopic,  // null if Gemini didn't return it — surfaces absence, not faked 'yes'
  };
}
