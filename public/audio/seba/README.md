# Seba Audio Assets

Pre-recorded Azure Cognitive TTS voice clips for Seba quips.
Generated as part of Phase v3.33.0 — Seba audio robustness.

## Voice
- **Voice ID:** `en-NG-AbeoNeural` (Nigerian male, neural)
- **Format:** MP3, 24kHz mono, 48kbps (Azure SDK constant `Audio24Khz48KBitRateMonoMp3`)
- **Rationale:** Continuity with the existing "guide" narration voice (line 18213 of `maat-reader.html`).

## Pool layout

| Pool | Quips | Trigger |
|---|---|---|
| `young-mer/{0..9}.mp3` | 10 | Encouragement after reflection submit (default register) |
| `young-sedjm/{0..7}.mp3` | 8 | "Listen deeper" prompts (low-effort answer) |
| `young-rekh/{0..5}.mp3` | 6 | "Look harder" pushes (alignment ≤3) |
| `young-celebration/{0..7}.mp3` | 8 | High-alignment celebration (alignment ≥8) |
| `young-achievement/{0..3}.mp3` | 4 | Tier-up + streak completion |
| `elder-sema/{0..5}.mp3` | 6 | Standalone Sema overlay open |
| `elder-sema-daily/{0..7}.mp3` | 8 | Daily Sema flow open |
| `elder-sema-redirect/{0..3}.mp3` | 4 | Sema "look again" path |
| `elder-sema-approval/{0..4}.mp3` | 5 | Sema pair joined |

**Total: 59 MP3s, ~1.1 MB.** Plus `public/audio/silent.mp3` (1-frame silent prime, ~1.2 KB) for first-user-gesture audio unlock.

## ORDER MATTERS

The `<idx>` in the file path is the position in the corresponding JS array in `maat-reader.html` (`YOUNG_SEBA_QUIPS` / `ELDER_SEBA_QUIPS`). **Reordering the JS array WITHOUT regenerating audio breaks the mapping** — index 0 audio will play but the caption will show a different quip.

Safe operations:
- **Append** a new quip to the end of an array → run `node generate-seba-quips.mjs <pool>` to fill in the new index.
- **Replace** an existing quip text → delete that single MP3, then regen the pool.

Unsafe:
- **Reorder** quips → regenerate the entire pool to re-align audio↔text.
- **Insert** in the middle → audio↔text shift; regen the entire pool.

## Regeneration

```bash
# All pools (idempotent — skips existing files ≥5KB)
node generate-seba-quips.mjs

# One pool (use exact key from the table above)
node generate-seba-quips.mjs young-mer

# Force regenerate one quip — delete it first
rm public/audio/seba/young-mer/0.mp3
node generate-seba-quips.mjs young-mer

# Dry-run (print SSML, no Azure call) — sanity check prompt rendering
node generate-seba-quips.mjs --dry-run | head -40
```

Requires `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` env vars (read from `.env` via `dotenv`).

## SSML emphasis

Each quip is rendered with SSML `<emphasis level="moderate">` on canonical Africana terms per the Cultural Consensus Panel mandate from the architecture-gate verdict (`docs/superpowers/round-tables/2026-04-28-seba-audio-architecture-gate.md`):

> Maat, Ma'at, Sema, Per Ankh, Seba, Hem-Sba, Sunu Sba, Wabau, Sesh en Per Ankh, Shemes Imhotep, Maa Kheru, Kheru, Ankh, ka, ba

Longest-first ordering prevents bare "Sba" (no canonical term) from matching inside compound terms like "Hem-Sba".

## Cost

~$0.10 total Azure TTS cost for full catalog regen (Azure neural TTS pricing as of 2026 — ~$1 per 100K characters; full catalog is ~5K characters).

## Resilience

The generator (`generate-seba-quips.mjs`) hardens against transient Azure WebSocket drops (StatusCode 1006) with exponential-backoff retry. Undersized outputs (<5KB) are treated as transient and retried; persistent undersize throws to surface degenerate output before shipping.

## Coverage report

Run `npm run audit:seba-audio` (Seba Task 17) to regenerate `docs/superpowers/coverage/seba-audio.md`, which lists pool quip counts, MP3 counts, and which pools have wired call sites.

## Architecture-gate verdict

`docs/superpowers/round-tables/2026-04-28-seba-audio-architecture-gate.md` — 7 voices verbally cleared the architecture (Khepri, Cultural Consensus Panel, Imani, Sam, Maya, Nia, Tom).

## Plan

`docs/superpowers/plans/2026-04-28-seba-audio-robustness.md` — 24-task TDD plan for v3.33.0.
