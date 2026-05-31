// senebty/data/threshold/khaemwaset/story.js
// Khaemwaset Threshold — pre-F1 onboarding for Per Ankh Senebty wing.
// Per docs/superpowers/specs/2026-05-04-senebty-v1-finish-design.md
// Tone canon: skills/docs/project/seba-voice-senebty.md
// Khepera binding: Memphite Ptah-iri anchor required in Seba copy.
//
// Story content authored 2026-05-04 per tone canon. User-approved register.
// Subject to tone-canon RT review at M5.
//
// Africana sources for Memphite Theology: Lichtheim *Ancient Egyptian Literature, Vol. I*
// (translation source); cross-check Obenga *African Philosophy: The Pharaonic Period*
// (Africana counter-reading per feedback_africana_source_precedence binding).

const KHAEMWASET_THRESHOLD = {
  id: 'threshold-khaemwaset',
  type: 'threshold',
  level: 1,
  powerWord: 'SENEB',
  semaPair: 'sleep-and-waking',
  giftId: 'recipe-honey-date-paste',
  chunks: [
    {
      text: 'A boy named Khaemwaset wakes before the sun in the city of Waset. The room is dark. His mother sleeps. His sister sleeps. The Nile sleeps too, dark and slow under the stars. Khaemwaset sits up on his reed mat. He does not yawn. He does not stretch. He breathes. One breath in. One breath out. The morning has not yet been made. He is the one who will help to make it.',
      vocab: ['Khaemwaset', 'Waset', 'Nile'],
      sebaIntro: 'My dear {name}, this is Khaemwaset, a boy your age. He will teach you how morning is made.',
      sebaAfter: 'Khaemwaset breathes before he does anything else. The breath is iri. Read on, {name}.',
    },
    {
      text: 'When the Nile begins to brighten, Khaemwaset stands. He walks past his sleeping family. He walks past the dogs curled by the door. He walks down the path to the river. The herons are waking. The fishermen are waking. Khaemwaset is one of them now. He kneels at the water. He looks up at the sky and waits for Ra. Ra is the sun. Ra is the one who rises with the breath of the world.',
      vocab: ['Ra', 'heron'],
      sebaIntro: 'The morning has not yet started. {name}, watch what Khaemwaset does next.',
      sebaAfter: 'He waits. Waiting is iri too, when it is the right kind. Read on.',
    },
    {
      text: 'Ra crosses the eastern hills. The sky turns the color of honey. The river turns the color of honey. Khaemwaset takes a long breath. He fills his chest. He counts in his head: one, two, three, four, five, six. Six breaths with Ra. The morning is in his chest now. He stands. He walks back to the city. He walks toward the Per Ankh — the House of Life — where the sunu and the scribes are already waking, already breathing, already at the work of being healthy.',
      vocab: ['Per Ankh', 'sunu', 'scribe'],
      sebaIntro: 'Watch the morning being made. Six breaths. Then the work begins.',
      sebaAfter: 'Ptah spoke and the world was made. You breathe and your morning is made. Khaemwaset breathed with Ra. Now you. One minute. Ra rises with you.',
    },
  ],
  comprehensionPool: [
    {
      kind: 'character',
      q: 'Who is the boy in this story?',
      a: 'Khaemwaset',
      distractors: ['Imhotep', 'Ra', 'a fisherman'],
    },
    {
      kind: 'setting',
      q: 'Where does Khaemwaset live?',
      a: 'Waset, on the Nile',
      distractors: ['Memphis, by the sea', 'Saqqara, in the desert', 'A village far from the river'],
    },
    {
      kind: 'sequence',
      q: 'What does Khaemwaset do FIRST when he wakes up?',
      a: 'He breathes',
      distractors: ['He yawns and stretches', 'He goes to the Per Ankh', 'He looks for his mother'],
    },
    {
      kind: 'vocabulary',
      q: 'What does the word "Senebty" mean?',
      a: 'Be in health (a wish and a command)',
      distractors: ['Good morning', 'See you tomorrow', 'Welcome home'],
    },
    {
      kind: 'vocabulary',
      q: 'What is the Per Ankh?',
      a: 'The House of Life — a Kemetic school of medicine and learning',
      distractors: ['A fishing boat on the Nile', 'A pyramid for the dead', 'A festival for Ra'],
    },
    {
      kind: 'inference',
      q: 'Why does Khaemwaset wake before the sun?',
      a: 'To breathe with Ra and help the morning be made',
      distractors: ['Because his mother makes him', 'Because he is afraid of the dark', 'Because he is a fisherman'],
    },
  ],
  iriCheckpoint: {
    afterChunk: 3,
    iriType: 'BREATH_IRI',
    durationSeconds: 60,
    prompt: 'Khaemwaset breathed with Ra. Now you. One minute. Ra rises with you.',
    evidenceShape: { breathsCounted: 'integer', durationMs: 'integer' },
    sebaPostIri: 'You have iri. The ancestors see. The morning is in your chest now. Welcome inside the Per Ankh, {name}.',
  },
  citations: [
    'Memphite Theology / Shabaka Stone, trans. Lichtheim *Ancient Egyptian Literature, Vol. I* (Berkeley, 1973), pp. 51-57',
    'Obenga *African Philosophy: The Pharaonic Period* (Per Ankh, 2004) — Africana counter-reading on Ptah\'s iri',
    'Per Ankh as institutional site: Edfu, Memphis, Sais — see senebty/lib/glossary-entries.js per-ankh comment block',
  ],
};

if (typeof window !== 'undefined') {
  window.Senebty = window.Senebty || {};
  window.Senebty.khaemwasetThresholdStory = KHAEMWASET_THRESHOLD;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KHAEMWASET_THRESHOLD };
}
