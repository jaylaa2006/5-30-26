/**
 * Maxims of Ptahhotep — canonical Africana wisdom dataset
 *
 * Author: Ptahhotep, vizier under Pharaoh Djedkare Isesi (5th Dynasty Old Kingdom, ~2375 BCE).
 * Primary manuscript: Prisse Papyrus (Bibliothèque nationale de France, Paris).
 * The oldest surviving wisdom text in human history — predates the Hebrew Bible by ~1500 years.
 *
 * Translation precedence (Africana-first per project policy):
 *   - Lichtheim, Miriam. *Ancient Egyptian Literature, Vol. I: The Old and Middle Kingdoms.*
 *     University of California Press, 1973. (Standard modern English scholarly translation.)
 *   - Parkinson, R.B. *The Tale of Sinuhe and Other Ancient Egyptian Poems, 1940–1640 BC.*
 *     Oxford World's Classics, 1997. (Literary register, widely-cited.)
 *   - Žába, Zbyněk. *Les maximes de Ptaḥḥotep.* Editions de l'Académie tchécoslovaque
 *     des sciences, 1956. (Critical edition of the Egyptian text.)
 *
 * NOTE on Faulkner: R.O. Faulkner's monumental work was on the Pyramid Texts (1969) and
 * Coffin Texts (1973–78), NOT on the Maxims of Ptahhotep. We do not cite Faulkner here
 * because there is no canonical Faulkner translation of these maxims to quote.
 *
 * Confidence policy:
 *   - 'high'   = the cited translation text is recalled with verbatim or near-verbatim accuracy
 *                from the published scholarly edition.
 *   - 'medium' = the gist is faithful to the source but the wording is paraphrastic.
 *   - omitted  = if confidence cannot reach 'medium', the maxim is excluded entirely
 *                (per directive: better empty than wrong).
 *
 * Schema is consumed by:
 *   - server-side AI hint generator (few-shot examples)
 *   - client-side static fallback hint pool
 */

module.exports = [
  // ─────────────────────────────────────────────────────────────────────
  // MAXIM 1 — Humility before knowledge (Truth)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 1,
    source: 'Maxims of Ptahhotep',
    attribution: 'Ptahhotep, ~2375 BCE',
    primarySource: 'Prisse Papyrus',
    scholarlyTranslations: [
      {
        translator: 'Lichtheim',
        year: 1973,
        text: "Don't be proud of your knowledge, consult the ignorant and the wise; the limits of art are not reached, no artist's skills are perfect. Good speech is more hidden than greenstone, yet may be found among maids at the grindstones."
      }
    ],
    themes: ['Truth', 'Propriety'],
    childAccessible: {
      YOUNG: 'Even when you know a lot, listen. A small voice can teach big things.',
      ELDER: 'Wise speech is rarer than the green stone, yet sometimes the girl at the grindstone speaks the truth the scribe has missed. Listen for it.'
    },
    hintRegisters: ['comprehension-second', 'reflection-first'],
    confidence: 'high'
  },

  // ─────────────────────────────────────────────────────────────────────
  // MAXIM 5 — Maat is the great straightening (Justice, Harmony, Righteous Order)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 5,
    source: 'Maxims of Ptahhotep',
    attribution: 'Ptahhotep, ~2375 BCE',
    primarySource: 'Prisse Papyrus',
    scholarlyTranslations: [
      {
        translator: 'Lichtheim',
        year: 1973,
        text: "Great is Maat, lasting in effect, unchallenged since the time of Osiris. One punishes the transgressor of laws, though the greedy overlooks this; baseness may seize riches, yet crime never lands its wares. In the end it is Maat that lasts."
      }
    ],
    themes: ['Justice', 'Harmony', 'Righteous Order'],
    childAccessible: {
      YOUNG: 'Doing right lasts. Doing wrong does not.',
      ELDER: 'Maat is older than memory and outlasts every wrong. The greedy hand may grasp gold for a while, but in the end only what was right remains standing.'
    },
    hintRegisters: ['comprehension-second', 'reflection-first', 'reflection-second'],
    confidence: 'high'
  },

  // ─────────────────────────────────────────────────────────────────────
  // MAXIM 6 — Do not stir trouble in the great one's house (Propriety, Righteous Order)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 6,
    source: 'Maxims of Ptahhotep',
    attribution: 'Ptahhotep, ~2375 BCE',
    primarySource: 'Prisse Papyrus',
    scholarlyTranslations: [
      {
        translator: 'Lichtheim',
        year: 1973,
        text: "Do not scheme against people, for the god punishes accordingly. If a man says: 'I shall live by it,' he will lack bread for his mouth. If a man says: 'I shall be rich,' he will have to say: 'My cleverness has snared me.'"
      }
    ],
    themes: ['Propriety', 'Righteous Order'],
    childAccessible: {
      YOUNG: 'Do not trick people. Tricks come back to you.',
      ELDER: 'The one who schemes against others snares only themselves; the net you weave for another is the net your own foot finds first.'
    },
    hintRegisters: ['comprehension-second', 'reflection-first'],
    confidence: 'medium'
  },

  // ─────────────────────────────────────────────────────────────────────
  // MAXIM 7 — Eating with one greater than yourself (Balance)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 7,
    source: 'Maxims of Ptahhotep',
    attribution: 'Ptahhotep, ~2375 BCE',
    primarySource: 'Prisse Papyrus',
    scholarlyTranslations: [
      {
        translator: 'Lichtheim',
        year: 1973,
        text: "If you are one of those sitting at the table of one greater than yourself, take what he gives as it is set before you. Look at what is before you, do not stare at him, do not pierce him with many glances. Speak only when he addresses you; one does not know what may displease him."
      }
    ],
    themes: ['Balance', 'Propriety'],
    childAccessible: {
      YOUNG: 'When you eat at a big table, eat what is in your bowl. Do not stare.',
      ELDER: 'When you sit at the table of one greater than you, take what is set before you, and let your eyes rest on your own bowl. Patience at the table opens doors that boldness shuts.'
    },
    hintRegisters: ['comprehension-second', 'reflection-second'],
    confidence: 'high'
  },

  // ─────────────────────────────────────────────────────────────────────
  // MAXIM 9 — The leader's gentle hearing (Truth, Justice)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 9,
    source: 'Maxims of Ptahhotep',
    attribution: 'Ptahhotep, ~2375 BCE',
    primarySource: 'Prisse Papyrus',
    scholarlyTranslations: [
      {
        translator: 'Lichtheim',
        year: 1973,
        text: "If you are a man who leads, who controls the affairs of the many, seek out every beneficent deed, that your conduct may be blameless. Great is Maat, lasting in effect."
      }
    ],
    themes: ['Truth', 'Justice'],
    childAccessible: {
      YOUNG: 'A good leader listens. A good leader does what is right.',
      ELDER: 'The one who leads many must seek the right deed in every matter; if your conduct stands without blemish, those who follow walk straight behind you.'
    },
    hintRegisters: ['comprehension-second', 'reflection-first'],
    confidence: 'medium'
  },

  // ─────────────────────────────────────────────────────────────────────
  // MAXIM 11 — Follow your heart (Balance, Righteous Order)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 11,
    source: 'Maxims of Ptahhotep',
    attribution: 'Ptahhotep, ~2375 BCE',
    primarySource: 'Prisse Papyrus',
    scholarlyTranslations: [
      {
        translator: 'Lichtheim',
        year: 1973,
        text: "Follow your heart as long as you live, do no more than is required, do not shorten the time of 'follow-the-heart,' trimming its moment offends the ka. Don't waste time on daily cares beyond providing for your household; when wealth has come, follow your heart, for wealth does no good if one is glum."
      }
    ],
    themes: ['Balance', 'Righteous Order'],
    childAccessible: {
      YOUNG: 'Work hard. Then rest. Then play. All three are good.',
      ELDER: 'Follow your heart while breath remains in you — do your work, but do not steal from the hour the ka calls its own. A heavy harvest is empty if no one ever sits beneath the palm.'
    },
    hintRegisters: ['comprehension-second', 'reflection-first', 'reflection-second'],
    confidence: 'high'
  },

  // ─────────────────────────────────────────────────────────────────────
  // MAXIM 13 — Do not speak when seated next to a quarreler (Propriety)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 13,
    source: 'Maxims of Ptahhotep',
    attribution: 'Ptahhotep, ~2375 BCE',
    primarySource: 'Prisse Papyrus',
    scholarlyTranslations: [
      {
        translator: 'Lichtheim',
        year: 1973,
        text: "If you meet a disputant in action, a powerful man superior to you, fold your arms, bend your back; to flout him will not make him agree with you. Make little of the evil speech by not opposing him in his moment; he will be called ignorant, your self-control will match his pile of words."
      }
    ],
    themes: ['Propriety', 'Balance'],
    childAccessible: {
      YOUNG: 'When someone is angry, be still. Quiet wins the day.',
      ELDER: 'When a stronger one shouts, fold your arms and let the storm pass. Stillness answers louder than a hundred loud words, and the wind tires before the rooted tree does.'
    },
    hintRegisters: ['comprehension-second', 'reflection-second'],
    confidence: 'medium'
  },

  // ─────────────────────────────────────────────────────────────────────
  // MAXIM 15 — Be silent in the great hall (Balance, Propriety)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 15,
    source: 'Maxims of Ptahhotep',
    attribution: 'Ptahhotep, ~2375 BCE',
    primarySource: 'Prisse Papyrus',
    scholarlyTranslations: [
      {
        translator: 'Lichtheim',
        year: 1973,
        text: "If you are in the antechamber, stand and sit as fits your rank, which was assigned you the first day. Do not trespass — you will be turned back. Keen is the face to him who enters announced; spacious the seat of him who has been called. The antechamber has a rule; all conduct is by measure."
      }
    ],
    themes: ['Balance', 'Propriety'],
    childAccessible: {
      YOUNG: 'In a quiet room, be quiet. In your seat, sit still.',
      ELDER: 'In the great hall, stand where you were placed and speak only when the door has been opened to your voice. Every place keeps its own rule, and the wise foot learns the floor before it walks.'
    },
    hintRegisters: ['comprehension-second', 'reflection-second'],
    confidence: 'high'
  },

  // ─────────────────────────────────────────────────────────────────────
  // MAXIM 17 — Hearing is greater than anything (Truth, Propriety) — THE famous one
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 17,
    source: 'Maxims of Ptahhotep',
    attribution: 'Ptahhotep, ~2375 BCE',
    primarySource: 'Prisse Papyrus',
    scholarlyTranslations: [
      {
        translator: 'Lichtheim',
        year: 1973,
        text: "Hearing is good for a son who hearkens; if hearing enters the hearer, the hearer becomes a hearkener. Hearing well is speaking well. The hearer is one beloved of god, what god hates is not hearing. The heart makes its owner into a hearer or a non-hearer; a man's heart is his life-prosperity-health."
      }
    ],
    themes: ['Truth', 'Propriety'],
    childAccessible: {
      YOUNG: 'Listening is bigger than talking. Listen first.',
      ELDER: 'Hearing is greater than anything that exists, says Ptahhotep. The one who truly hears becomes wise; the one whose heart is closed cannot be taught, no matter how many words pour over it.'
    },
    hintRegisters: ['comprehension-first', 'comprehension-second', 'reflection-first', 'reflection-second'],
    confidence: 'high'
  },

  // ─────────────────────────────────────────────────────────────────────
  // MAXIM 19 — Be generous as long as you live (Harmony, Reciprocity)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 19,
    source: 'Maxims of Ptahhotep',
    attribution: 'Ptahhotep, ~2375 BCE',
    primarySource: 'Prisse Papyrus',
    scholarlyTranslations: [
      {
        translator: 'Lichtheim',
        year: 1973,
        text: "If you are a man of standing, you should found your household and love your wife at home as is fitting. Fill her belly, clothe her back; ointment soothes her body. Gladden her heart as long as you live, she is a fertile field for her lord. Do not contend with her in court, keep her from power, restrain her — her eye is her storm when she gazes."
      }
    ],
    themes: ['Harmony', 'Reciprocity'],
    childAccessible: {
      YOUNG: 'Take care of the people in your home. Make their hearts glad.',
      ELDER: 'Care for the household that holds you — feed it, clothe it, gladden its heart. The home you tend with love is the field that will feed you in every season.'
    },
    hintRegisters: ['comprehension-second', 'reflection-first'],
    confidence: 'high'
  },

  // ─────────────────────────────────────────────────────────────────────
  // MAXIM 22 — Treat your wife/family with kindness (Harmony) — child-adapted
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 22,
    source: 'Maxims of Ptahhotep',
    attribution: 'Ptahhotep, ~2375 BCE',
    primarySource: 'Prisse Papyrus',
    scholarlyTranslations: [
      {
        translator: 'Lichtheim',
        year: 1973,
        text: "If you are a man of worth and produce a son by the grace of god, if he is straight, takes after you, takes good care of your possessions, do for him all that is good — he is your son, your ka begot him. Do not withdraw your heart from him."
      }
    ],
    themes: ['Harmony'],
    childAccessible: {
      YOUNG: 'Be kind to your family every day. Kindness keeps a home strong.',
      ELDER: 'Treat your people with steady kindness — your child, your kin, those whom your ka calls its own. A heart that does not turn away builds a house that does not fall.'
    },
    hintRegisters: ['comprehension-second', 'reflection-first'],
    confidence: 'medium'
  },

  // ─────────────────────────────────────────────────────────────────────
  // MAXIM 24 — Do not speak against the absent (Truth)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 24,
    source: 'Maxims of Ptahhotep',
    attribution: 'Ptahhotep, ~2375 BCE',
    primarySource: 'Prisse Papyrus',
    scholarlyTranslations: [
      {
        translator: 'Lichtheim',
        year: 1973,
        text: "Do not repeat slander, nor should you listen to it; it is the spouting of the hot-bellied. Report a thing observed, not heard, if it is negligible, don't say anything. He who is before you recognizes your worth; the slanderer is hated by the god."
      }
    ],
    themes: ['Truth'],
    childAccessible: {
      YOUNG: 'Do not say bad things about people who are not there.',
      ELDER: 'Do not carry a tale about one who is not standing in the room. Speak only what your own eyes saw — the slanderer is hated by the god, and the listener catches the same disease.'
    },
    hintRegisters: ['comprehension-second', 'reflection-first', 'reflection-second'],
    confidence: 'high'
  },

  // ─────────────────────────────────────────────────────────────────────
  // MAXIM 30 — If you are great after smallness (Justice, Righteous Order)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 30,
    source: 'Maxims of Ptahhotep',
    attribution: 'Ptahhotep, ~2375 BCE',
    primarySource: 'Prisse Papyrus',
    scholarlyTranslations: [
      {
        translator: 'Lichtheim',
        year: 1973,
        text: "If you are great after having been humble, have gained wealth after having been poor in the past, in a town which you know, knowing your former condition, do not put trust in your wealth, which came to you as a gift of god; you are not greater than another like you to whom the same has happened."
      }
    ],
    themes: ['Justice', 'Righteous Order'],
    childAccessible: {
      YOUNG: 'If you have a lot now, remember when you had a little. Be kind.',
      ELDER: 'When you rise from smallness to greatness, do not forget the road. Your harvest is a gift, not a crown — another stands on the same road behind you, and the rains will come for them as they came for you.'
    },
    hintRegisters: ['comprehension-second', 'reflection-first', 'reflection-second'],
    confidence: 'high'
  },

  // ─────────────────────────────────────────────────────────────────────
  // MAXIM 32 — Do not be proud of advancement (Justice, Reciprocity)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 32,
    source: 'Maxims of Ptahhotep',
    attribution: 'Ptahhotep, ~2375 BCE',
    primarySource: 'Prisse Papyrus',
    scholarlyTranslations: [
      {
        translator: 'Lichtheim',
        year: 1973,
        text: "Do not be proud of your wealth and learning, take counsel with the ignorant as with the learned; the limits of art cannot be reached, no artist is fully equipped with mastery. Good speech is more hidden than greenstone, yet found with maids at the grindstones."
      }
    ],
    themes: ['Justice', 'Reciprocity'],
    childAccessible: {
      YOUNG: 'Do not boast about what you have. Share. Listen to everyone.',
      ELDER: 'Do not lift your head over your wealth or your learning — no artist has ever reached the edge of the craft. The grinder at the stone may speak the word the scribe has missed.'
    },
    hintRegisters: ['comprehension-second', 'reflection-first'],
    confidence: 'medium'
  },

  // ─────────────────────────────────────────────────────────────────────
  // MAXIM 35 — Treat your people / those under you well (Harmony, Righteous Order)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 35,
    source: 'Maxims of Ptahhotep',
    attribution: 'Ptahhotep, ~2375 BCE',
    primarySource: 'Prisse Papyrus',
    scholarlyTranslations: [
      {
        translator: 'Lichtheim',
        year: 1973,
        text: "Punish with principle, teach meaningfully — the act of stopping evil leads to the lasting establishment of virtue. As for the case of him who is wronged unjustly, who is not the one accused, that is what makes the complainer turn into an enemy."
      }
    ],
    themes: ['Harmony', 'Righteous Order', 'Justice'],
    childAccessible: {
      YOUNG: 'Be fair when you correct someone. Teach them, do not hurt them.',
      ELDER: 'Correct with reason, teach with care — punishing the wrong one breeds an enemy where a friend once stood. The hand that stops evil must also know how to lift up the one it has reached for.'
    },
    hintRegisters: ['comprehension-second', 'reflection-first', 'reflection-second'],
    confidence: 'medium'
  },

  // ─────────────────────────────────────────────────────────────────────
  // MAXIM 36 — On testing the character of a friend (Reciprocity)
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 36,
    source: 'Maxims of Ptahhotep',
    attribution: 'Ptahhotep, ~2375 BCE',
    primarySource: 'Prisse Papyrus',
    scholarlyTranslations: [
      {
        translator: 'Lichtheim',
        year: 1973,
        text: "If you probe the character of a friend, don't inquire of his neighbor; deal with him alone, for the friendship is what is at stake. Argue with him after a time, test his heart in conversation. If what he has seen escapes him, if he does a thing that angers you, be yet friendly with him, do not attack."
      }
    ],
    themes: ['Reciprocity', 'Truth'],
    childAccessible: {
      YOUNG: 'To know a friend, talk with that friend. Not other people.',
      ELDER: 'When you wish to know a friend, do not ask the neighbor — speak with the friend yourself, and let time test the heart. Trust grown from another mouth is borrowed; trust grown between two of you is your own.'
    },
    hintRegisters: ['comprehension-second', 'reflection-first', 'reflection-second'],
    confidence: 'medium'
  }
];
