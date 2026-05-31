# Two-Stage QA Protocol — PROJECT LAW

**Status:** Mandatory for all non-trivial implementations. Locked by user
directive 2026-05-16: *"this is the protocol you will use going forward on all
implementations - YOU MUST implement consistency coaches recommendations as
well as the round tables."* Followed up: *"you must implement all not top 4."*

This file is auto-loaded by CLAUDE.md as a project rule. Every contributor —
human or agent — is bound by it.

## What the protocol is

Two adversarial review stages, both executed *within the same implementation
turn* (not deferred to a separate deploy gate):

### Stage 1 — Adversarial Round Table (BEFORE implementation)

- Convene voices relevant to the domain. Typical mix:
  - **PM (adversarial)** — leads, scopes cost/benefit, surfaces what the
    change must NOT regress
  - **UX expert** — interaction + layout + reading rhythm
  - **Africana / cultural authority** — picture-book gravitas, body-holds
    binding, Kemetic continuity
  - **Maya (a11y)** — keyboard focus, screen-reader, reduced-motion,
    contrast, tap-targets ≥ 44px
  - **Performance engineer** — bandwidth, SW cache, mobile cold-load
  - **Mahlangu (ornament discipline)** — one motion / one accent per surface
  - **Biggers (composition)** — three-plane FG/MG/BG separation
  - **Pedagogical voice** (Hilliard for educators, Karenga / Acholonu for
    Africana scholarship)
- Each voice **verbalizes** critique with line-level citations (file + line,
  not vague gestures).
- Surface **top-N consensus recommendations**.
- **Implement ALL top-N.** Not the easy ones — all of them.
- Document the voices and recommendations in the commit message.

### Stage 2 — Consistency Coach Adversarial Audit (AFTER stage-1 implementation)

- A **separate fresh voice** (the Consistency Coach) audits the stage-1 fix.
- The Coach's job:
  - Verify the stage-1 RT's diagnosis was correct (stage-1 RTs often
    misdiagnose root causes on first hypothesis — the Coach catches this)
  - Surface edge cases the stage-1 RT missed (typically 5-7 per audit)
  - Surface meta-discipline notes for the next implementation
- Coach output structure:
  - Numbered recommendations
  - Edge-case observations (each becomes a work item)
  - Meta-discipline notes (each becomes a memory update or rule addition)
- **Implement ALL Coach output, not just top-N.** User binding: *"you must
  implement all not top 4."*
- Document the Coach audit in the same commit message as stage 1.

## When to apply

| Change type | Protocol required? |
|---|---|
| New feature, even small | Yes — both stages |
| Bug fix touching user-facing behavior | Yes — both stages |
| UX / CSS / visual change | Yes — both stages |
| Refactor that changes any public surface | Yes — both stages |
| Test-only update (no behavior change) | Stage 1 sufficient (document) |
| Typo / comment-only fix | Neither |
| Cache-buster bump | Neither |
| Doc update | Stage 1 sufficient |

## When the Coach catches stage-1 misdiagnosis

This happens often. Examples from the medu-column audit (2026-05-16):
- Stage-1 CSS Architect blamed missing `position: relative` for an overflow
  defect. The Coach verified — `position: relative` was present. The real
  bug was content overflow on the absolute child.
- The Coach also caught 5 edge cases the stage-1 RT missed.

**Carry-forward discipline:** Don't trust the first hypothesis. Verify with
code-level inspection BEFORE shipping. The Coach is the safety net.

## How to enforce in commits

Every commit that touches non-trivial code MUST include both stages in the
commit message body. Template:

```
<type>(<scope>): <subject>

<problem statement>

STAGE 1 — Adversarial RT (<voices>):
  - <rec 1 — what was done>
  - <rec 2 — what was done>
  - ...

STAGE 2 — Consistency Coach adversarial audit:
  - <rec 1 — what was done>
  - <edge case 1 — what was done>
  - <meta-discipline note — where it was saved>
  - ...
```

## How to enforce in CI

(Future work — currently aspirational, not yet wired.)

A future lint test could:
- Grep recent commit messages for the absence of "Stage 1" / "Stage 2"
  markers and warn if a substantial code change lacks both
- Block PRs that lack both stages documented

For now, the protocol is **manually enforced by the contributor's
discipline**. Repeated violation is a deploy-gate concern surfaced to the
user.

## Mandatory pre-commit verification (Coach binding, 2026-05-16)

**Before every commit** that touches:
- `senebty/lib/foundation-render.js`
- `VEO_AVAILABLE` map (additions, deletions, slug changes)
- Anything in `senebty/lib/*.js`
- Anything in `tests/senebty-*.test.mjs`
- Anything in `seba-story-api.mjs` route handlers

…the contributor MUST run the full `npm test` suite locally, NOT just
the test file most-recently touched. Reason: CI runs the full suite; a
local single-file run can miss cross-suite regressions (v3.51.6 and
v3.51.14 both shipped failing because earlier passes only ran one file).

```bash
npm test  # the full mandatory pre-commit verification
```

If the full suite is too slow, run at minimum:

```bash
node --test tests/senebty-*.test.mjs
```

before pushing.

### Enforcement: `.githooks/pre-commit` (v3.51.28, 2026-05-16)

The mandatory pre-commit verification is now **machine-enforced** via a
git hook at `.githooks/pre-commit`, wired by `git config core.hooksPath
.githooks`. On every `git commit`, the hook:

1. Diffs the staged file list against the changed-file → required-test
   mapping (foundation-render, parent-dashboard, daily-ritual,
   tier-modal, auth, seba-api).
2. Runs the implicated `npm run test:*` suites.
3. Blocks the commit on any failure, printing the last 30 lines of the
   test log so the contributor can fix it before retrying.

This closes the v3.51.6 / v3.51.14 / v3.51.17 / v3.51.19 / v3.51.23 /
v3.51.24 regression class — the keyboard-nav subagent (d5b9701) shipped
red because it skipped local `npm test`. The hook means no future
contributor can skip the check by accident.

**Bypass:** `NO_VERIFY=1 git commit ...` or `git commit --no-verify` —
allowed ONLY when the user has explicitly waived the gate (per the
project rule against silent --no-verify use).

**Clone-time wiring:** the hook lives in-tree under `.githooks/`, so
fresh clones must run `git config core.hooksPath .githooks` once. (Git
does not honor in-tree hooks paths by default for security reasons.)

## Test-discipline convention: `test-noveo` fake key

Tests that exercise the `<img>` IMG branch of `_renderArtSlot` MUST use
`foundationKey: 'test-noveo'` (a deterministically-fake key not in
`VEO_AVAILABLE`). This convention insulates IMG-path tests from
VEO_AVAILABLE expansion regressions (the v3.51.6 / v3.51.14 failure
mode). Using real foundation keys like `'tjau'` or `'four-treasures'`
is fragile — every time a Veo is added for that chunk, those tests
break.

See `tests/senebty-foundation-render.test.mjs` for the canonical
example. The header comment block (v3.51.14) documents the convention
in situ.

## Related rules

- `.claude/rules/enterprise-patterns.md` — Rule 1 (no silent catches),
  Rule 2 (late-binding installer), Rule 3 (manual browser smoke),
  Rule 4 (pure DOM construction), Rule 5 (cache-buster discipline)
- `.claude/rules/security.md` — input sanitization, no secret leaks
- `.claude/rules/server-rules.md` — server-specific bindings

The two-stage protocol is the META-RULE that ensures the others are
correctly applied: stage 1 catches whether the four enterprise rules were
followed; stage 2 catches whether stage 1 caught it.

## History

- 2026-05-16 — Established by user directive after the medu-netr cutoff
  audit. First applied to v3.51.11 (medu overflow + empty glyph strip)
  and v3.51.12 (static parchment). Both surfaced Coach-only edge cases
  that the stage-1 RT missed.
- 2026-05-16 — Embedded in repo as project law (this file) so future
  contributors and agents are bound by it without needing access to
  prior session memory.
