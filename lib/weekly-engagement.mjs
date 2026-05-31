// Pure helper: engagement-drift detection for weekly parent dispatch.
//
// Parents need honest weekly updates. The old email showed avg score + virtue
// bars, but virtue-bar inflation can hide the real signal: "your child's
// responses were warm but rarely addressed what the story asked." That is the
// King failure mode — the answers don't engage the question, but the rubric
// rewards tone anyway. Slice 1 fixed the per-response clamp; Slice 2 surfaces
// the weekly pattern so parents see it.
//
// Drift triggers a "Heads up" block in the email. Two independent signals,
// either is sufficient (the rubric's dual defense mirrored at the weekly scale):
//
//   1. Topic-engagement ratio is low.
//      onTopicRatio = (# on_topic='yes') / (total responses with any on_topic)
//      If < 0.6 across ≥3 scored responses, the week's pattern is drift.
//
//   2. Performative sincerity is common.
//      If ≥3 responses this week were tagged sincerity='performative',
//      the child is going through the motions, not reasoning.
//
// We require at least 3 scored responses before flagging — a single off-topic
// answer from a kid mid-homework isn't a pattern.

export function computeEngagementStats(responses){
  const list = Array.isArray(responses) ? responses : [];
  const withOnTopic = list.filter(r => r && typeof r.on_topic === 'string');
  const onTopicCount    = withOnTopic.filter(r => r.on_topic === 'yes').length;
  const partiallyCount  = withOnTopic.filter(r => r.on_topic === 'partially').length;
  const offTopicCount   = withOnTopic.filter(r => r.on_topic === 'no').length;
  const onTopicRatio    = withOnTopic.length > 0 ? (onTopicCount / withOnTopic.length) : null;

  const performativeCount = list.filter(r => r && r.sincerity === 'performative').length;
  const dismissiveCount   = list.filter(r => r && r.sincerity === 'dismissive').length;
  const genuineCount      = list.filter(r => r && r.sincerity === 'genuine').length;

  const MIN_FOR_DRIFT = 3;
  const DRIFT_RATIO_THRESHOLD = 0.6;
  const DRIFT_PERFORMATIVE_THRESHOLD = 3;

  const reasons = [];
  if (onTopicRatio !== null && withOnTopic.length >= MIN_FOR_DRIFT && onTopicRatio < DRIFT_RATIO_THRESHOLD) {
    reasons.push('off_topic');
  }
  if (performativeCount >= DRIFT_PERFORMATIVE_THRESHOLD) {
    reasons.push('performative');
  }
  const driftFlag = reasons.length > 0;

  return {
    total: list.length,
    totalWithOnTopic: withOnTopic.length,
    onTopicCount,
    partiallyCount,
    offTopicCount,
    onTopicRatio,
    performativeCount,
    dismissiveCount,
    genuineCount,
    driftFlag,
    driftReasons: reasons,
  };
}

// Human-readable summary the email template & Gemini insight prompt both use.
// Returns null when there's nothing notable (no drift, no headsUp block).
export function buildHeadsUp(stats, childName){
  if (!stats || !stats.driftFlag) return null;
  const name = childName || 'Your child';
  const lines = [];
  if (stats.driftReasons.includes('off_topic')) {
    const ratioPct = stats.onTopicRatio !== null ? Math.round(stats.onTopicRatio * 100) : 0;
    const off = stats.offTopicCount;
    const partial = stats.partiallyCount;
    lines.push(
      `${name}'s responses were warm but often didn't address what the story asked — ` +
      `${ratioPct}% stayed on topic (${off} off-topic, ${partial} partial). ` +
      `Worth reading a response together and asking what the question was really looking for.`
    );
  }
  if (stats.driftReasons.includes('performative')) {
    lines.push(
      `${stats.performativeCount} responses this week sounded more performative than genuine — ` +
      `the words were right, but the reasoning was thin. This usually means the child is tired ` +
      `or rushing. A short break or reading together helps more than another story.`
    );
  }
  return {
    title: 'Heads up',
    reasons: stats.driftReasons,
    lines,
  };
}
