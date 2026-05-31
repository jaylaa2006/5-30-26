// senebty/lib/tiers.js
// Six-tier initiatory ladder for Per Ankh Senebty.
// advancementCopy is locked verbatim from skills/docs/project/seba-voice-senebty.md
// "The Standard Phrases" section. Tone-canon violation = test failure (see tests/tiers.test.mjs).
//
// Phase 1.2 (2026-04-27) — mdw nṯr glyphs verified per Africana primary
// sources (Karenga, Carruthers, Obenga). Project-coined compound tier
// titles (hem-sba, seba-en-seneb, sunu-sba, shemes-imhotep) drop the glyph
// per project canon "ship without glyph rather than ship wrong glyph";
// art sigils for these tiers are deferred to a follow-up cycle (Phase 1.3).
//
// Confidence schema mirrors glossary-entries.js:
//   'high'   — single canonical Gardiner ideogram OR multi-sign attested compound
//   'medium' — multi-codepoint phonetic spelling per Faulkner/Allen
//   'low'    — currently unused
//   'none'   — glyph dropped (compound titles fusing proper names / coined plurals)
(function(){
  if (typeof window === 'undefined') return;
  window.Senebty = window.Senebty || {};
  window.Senebty.tiers = [
    {
      // Compound title coined by Senebty path (not historically attested).
      // Phase 1.2: previous mdwNtr U+132F4+U+1342F was S29+V011D — first sign
      // wrong (s not ḥ), V011D uncanonical. Glyph dropped; romanization only.
      key:'hem-sba',
      displayName:'Hem-Sba',
      translation:'Servant of the Star',
      mdwNtr:null,
      mdwNtrConfidence:'none',
      sigilSrc:'/images/senebty/sigils/hem-sba.png',
      gate:{ type:'entry' },
      advancementCopy:'You stand at the gate. The Per Ankh sees you. Iri once, and you enter.'
    },
    {
      // Compound title coined by Senebty path (not historically attested).
      // Phase 1.2: previous mdwNtr U+132F4+U+13171 read "sw" (he/him pronoun),
      // not sb3-n-snb. Glyph dropped; romanization only.
      key:'seba-en-seneb',
      displayName:'Seba en Seneb',
      translation:'Student of Health',
      mdwNtr:null,
      mdwNtrConfidence:'none',
      sigilSrc:'/images/senebty/sigils/seba-en-seneb.png',
      gate:{ type:'iriCount', value:1 },
      advancementCopy:'You have iri once. You are no longer at the gate. Come inside the Per Ankh. Today you become Seba en Seneb — Student of Health.'
    },
    {
      // Historically attested compound (pr-ʿnḫ "House of Life" is real).
      // Phase 1.2: 4-sign sš-n-pr-ʿnḫ = U28(scribe palette)+N35(n)+O1(house)+S34(ankh)
      // per Allen 2014 §19.2 and Faulkner p.112.
      key:'sesh-en-per-ankh',
      displayName:'Sesh en Per Ankh',
      translation:'Scribe of the House of Life',
      mdwNtr:'\u{13351}\u{13216}\u{13250}\u{132F9}',
      mdwNtrConfidence:'medium',
      gate:{ type:'foundationsCompleted', value:8 },
      advancementCopy:'Eight Foundations. Eight iri. You can now teach what you have done. Today you become Sesh en Per Ankh — Scribe of the House of Life.'
    },
    {
      // Africana override (Karenga, Carruthers): wab is embodied purity through
      // practice. D60 (pouring-water purification) images that attainment.
      // Phase 1.2: previous mdwNtr U+132AA was X4 (bread/food) — wrong.
      key:'wabau',
      displayName:'Pure Ones',
      translation:'Pure Ones (you join the wabau)',
      mdwNtr:'\u{130C2}',
      mdwNtrConfidence:'high',
      gate:{ type:'streakDays', value:21 },
      advancementCopy:'Twenty-one mornings. The Daily Senebty Ritual is in your body now, not your memory. Today you become Wabau — Pure One.'
    },
    {
      // Compound title coined by Senebty path (not historically attested).
      // Phase 1.2: previous mdwNtr U+132F4+U+132AB was S29+Q4 (s + headrest "wrs").
      // Q4 reads "to lie down/sleep," not sunu. Glyph dropped; romanization only.
      key:'sunu-sba',
      displayName:'Sunu Sba',
      translation:'Apprentice Physician',
      mdwNtr:null,
      mdwNtrConfidence:'none',
      sigilSrc:'/images/senebty/sigils/sunu-sba.png',
      gate:{ type:'teachingIri', value:1 },
      advancementCopy:'You have taught another. Teaching is the proof of mastery. Today you become Sunu Sba — Apprentice Physician.'
    },
    {
      // Compound title fusing proper name (Imhotep) with šms.
      // Phase 1.2: previous mdwNtr U+132AC was Q5 (wooden chest) — wrong.
      // Compound proper-name title cannot be reduced to a single sign without
      // misleading; glyph dropped, romanization only.
      key:'shemes-imhotep',
      displayName:'Shemes Imhotep',
      translation:'Disciple of Imhotep',
      mdwNtr:null,
      mdwNtrConfidence:'none',
      sigilSrc:'/images/senebty/sigils/shemes-imhotep.png',
      gate:{ type:'composite', requires:['wabau','sunu-sba'] },
      advancementCopy:'Imhotep is no longer a story to you. He is a door. Today you walk through. Shemes Imhotep — Disciple of Imhotep. The content path opens. There is no end now, only deeper.'
    }
  ];
})();
