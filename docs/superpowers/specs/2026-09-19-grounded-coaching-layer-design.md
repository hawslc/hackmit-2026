# Grounded coaching layer — design

**Date:** 2026-09-19
**Status:** Approved, ready for implementation planning

## Problem

The AI review produces confident nonsense on thin samples. For a 7-second clip it
returns numeric scores (`Teaching 33/100`), invents expectations the clip can't
support ("develop a detailed lesson plan…"), contradicts itself across sections
("checks for understanding" flagged both strongest and weakest), and attaches
quotes that don't demonstrate the claim they anchor. The root cause is
architectural: six reviewers each independently fill a rubric box, with no shared
grounding and no evidence gate, and the client renders all six.

## Goal

Replace the rubric-box output with a single, grounded, actionable focus, backed by
progressive-disclosure detail — and only when the transcript actually supports it.
The guiding principle: *don't tell the user what a good teacher generally does; tell
them what they specifically did, why it mattered, and exactly what to try next time.*

## Approach

Keep the six reviewers running (the "hybrid" choice), but change what they emit and
add a selection/coaching layer on top.

- Reviewers stop filling distinct rubric boxes. Each returns the **same grounded
  shape**: a list of observations, every one anchored to a verbatim transcript quote.
- A new `coach.ts` step (replacing `synthesize.ts`) collects those observations into
  a pool, **validates each quote actually appears in the transcript**, ranks them by
  impact, and runs *one* LLM coach pass that rewrites the top observations into
  actionable cards. Because the coach is handed real quotes, it cannot invent
  evidence — it only rephrases what it receives.

Rejected alternatives:

- *Single freestyle coach LLM over raw reviewer output* — reintroduces the
  ungrounded-freestyle problem and needs heavy output validation regardless.
- *Do gating/selection in the client* — the client can't verify quotes against the
  transcript or reason about appropriateness; grounding belongs server-side.

## Data flow

```
transcript + metrics
  → 6 reviewers (each returns Observation[], prompts hardened)
  → collect candidates → VALIDATE each quote is in the transcript → drop ungrounded
  → rank by impact (missing-core > teaching > structure/engagement/delivery > hedging)
  → one coach LLM pass (batched; deterministic fallback)
  → { evidenceState, focus, more[] }
```

## Contract changes (`shared/src/review.ts`)

The per-reviewer output types (`DeliveryReview`, `CoverageReview`, `TeachingReview`,
`StructureReview`, `EngagementReview`, `ConfidenceReview` and their moment/score
sub-types) are no longer part of the response. `SessionReview` becomes:

```ts
export interface CoachingCard {
  category: SectionId;      // which reviewer surfaced it (for the label)
  headline: string;         // "Stronger questions" — 2–4 words
  quote: string;            // verbatim, validated against transcript
  atSec: number;            // seek target
  whatHappened: string;     // neutral observation
  whyItMatters: string;     // one sentence
  tryInstead: string;       // a concrete line the user could actually say
  practiceGoal: string;     // the retry target
}

export interface SessionReview {
  evidenceState: "coached" | "insufficient";
  focus: CoachingCard | null;   // the ONE main thing; null when insufficient
  more: CoachingCard[];         // 0..~3 additional grounded cards (progressive disclosure)
}
```

Notes:

- **No `summary` field.** The narrative summary is removed entirely.
- **No numeric section scores.** Removing them fixes the fake-precision problem and
  removes the "strongest X / improve X" contradiction, which came from the
  score-to-percent mapping in `reviewView.ts`.
- Measured delivery metrics (wpm, fillers/min, pauses) continue to ship separately
  and render in `DeliveryMetricsCard`, **unchanged** (see Scope boundary).

## Internal reviewer shape (`ai-review`)

Every reviewer returns a list of the same grounded observation. This is what makes
the prompts fit the framework, and it kills the contradiction and scores at the
source.

```ts
interface Observation {
  category: SectionId;
  quote: string;                 // verbatim; atSec filled by locateQuoteSec, not the LLM
  observation: string;           // neutral: what happened
  whyItMatters: string;
  suggestion?: string;           // seed; the coach finalizes tryInstead/practiceGoal
}
```

`atSec` is resolved server-side by locating the quote in the transcript segments
(reuse `locateQuoteSec`), never taken from the LLM.

## Evidence gating

Per-category, evidence-driven — no arbitrary duration floor as the primary gate.

- **Grounding gate.** A candidate whose quote cannot be located verbatim in the
  transcript is dropped. (Coverage is the one exception — see below.) This is the
  hard rule: every critique must cite a quote that demonstrates the behavior.
- **Per-category.** A reviewer that produces no grounded observation contributes
  nothing and simply does not appear. There is no per-category "not enough evidence"
  placeholder — the category is just absent.
- **Global.** If the grounded pool is empty after validation →
  `evidenceState: "insufficient"`, `focus: null`, `more: []`. The screen shows one
  honest line: *"Not enough to evaluate yet — record a longer segment."* Measured
  metrics still render if their own window is valid.
- **Appropriateness.** Absence is never a failure. Reviewers must not emit
  "you didn't do X". A missing behavior is only flagged when a specific quoted moment
  would clearly have benefited from it (and that moment is quoted).

### Coverage: the one justified absence signal

Coverage runs only when a lesson plan exists (already skipped otherwise). A
**missing or partial CORE concept** is a legitimate candidate even though it has no
transcript quote — it is grounded by the *lesson plan*, which explicitly lists the
concept. Covered and optional concepts produce no coaching. Coverage keeps its
internal concept-checklist shape but contributes only core gaps to the pool; those
candidates are marked as plan-grounded so the grounding gate does not require a
transcript quote for them.

## Consistency

The focus and the supporting cards are all derived from the *same* validated pool in
the *same* coach pass — never filled in independently per box. That is the
"establish observations first, then derive feedback" model, and it is what prevents
one section calling a moment strong while another calls it weak.

## Reviewer prompts

A shared rule block is prepended to every reviewer, replacing the freestyle framing:

> You are one specialist reviewer. Surface only **grounded moments** — specific
> things the speaker actually said, each anchored to a verbatim quote.
> - Every item must quote the transcript verbatim, and that quote *alone* must
>   demonstrate the behavior. If it doesn't, drop it.
> - Never reward or penalize absence. No "you didn't…", "consider adding…",
>   "develop a plan…". Only flag a missing behavior when you can quote the specific
>   moment that would've been better with it.
> - Found nothing grounded? Return an empty list. For short clips that's the correct
>   answer.
> - Do not score, rank, summarize, or compare categories — a later step does that.
>   Return at most 3 of your clearest moments.
>
> Return JSON: `{ "observations": [ { "quote", "observation", "whyItMatters", "suggestion" } ] }`

Only the "what to look for" line differs per reviewer:

| Reviewer | Instruction |
|---|---|
| **Delivery** | A quoted stretch that genuinely rambles, is verbose, or is unclear. |
| **Teaching** | A quoted explanation that was abstract where an example would land; a check so closed a student could pass without reasoning; a term used without being made accessible. From real quotes only — **no scores**. |
| **Structure** | A quoted seam: a jump with no transition, missing setup, an abrupt end. Quote the seam. |
| **Engagement** | A quoted open question, or a flat monologue stretch. A single broad "anything else?" is a *weak* check, not strong engagement. |
| **Confidence** | Hedging that undercuts authority in a quote ("I think maybe", "sort of"). **Do not** treat discourse markers (okay, so, like) as errors — fillers are measured separately. |
| **Coverage** | Unchanged concept-checklist shape, but only a **missing/partial CORE** concept escalates to a candidate, grounded by the lesson plan. Covered/optional produce no feedback. |

## Coach prompt (`coach.ts`, replaces `synthesize.ts`)

Given the ranked grounded observations, write ONE focus card plus up to 3 supporting
cards.

> You are the lead mentor. You are given a ranked list of grounded observations, each
> with a verbatim quote and why it matters. Turn the top observation into ONE focus
> card and up to 3 others into supporting cards. **Do not introduce any claim not in
> the observations. Do not invent quotes; reuse the given quotes verbatim.**
> For each card produce: `headline` (2–4 words), `whatHappened`, `whyItMatters`,
> `tryInstead` (a concrete line the speaker could say next time), `practiceGoal`
> (a one-sentence retry target).
> Return JSON `{ "focus": Card | null, "more": Card[] }`.

**Ranking (deterministic, before the coach pass):** missing/partial CORE concept >
teaching observation > structure/engagement/delivery observation > hedging. Ties keep
reviewer order. The top-ranked candidate becomes the focus input; the next few (cap
~3) become supporting inputs.

**Fallback.** If the coach LLM call fails or returns unusable JSON, build the focus
card directly from the top-ranked observation's fields (`observation` →
`whatHappened`, `whyItMatters`, `suggestion` → `tryInstead`) and a generic
`practiceGoal`. Never throws; degrades to a grounded-but-less-polished card.

## Client changes

- **`reviewView.ts`**: gutted down to mapping `focus`/`more` → cards. Delete
  `pickHighlighted` and all score math. Delete the per-section detail mappers.
- **`ReviewScreen.tsx`**: remove the "Your review" / "Top priority" heading prose and
  the summary paragraph. The page leads directly with the **Focus card**, then the
  expandable `more` cards, then `DeliveryMetricsCard`, then "Practice again". The only
  words on screen are the cards' own content and the metrics. When
  `evidenceState === "insufficient"`, render the single "Not enough to evaluate yet"
  line in place of the cards.
- **Card component**: `SectionCard` is replaced/adapted into a `CoachingCard`
  renderer (headline, quote with seek-to-`atSec`, whatHappened, whyItMatters,
  tryInstead, practiceGoal). `more` cards are collapsed by default (progressive
  disclosure).
- **Retry loop.** "Practice again" carries `focus.practiceGoal` into the Practice
  screen as a reminder banner. This is the one change touching `PracticeScreen`.

## Scope boundary

**In scope:** the coaching layer, grounded-observation refactor of the reviewers,
per-category evidence gating, the actionable card format, dropping numeric scores and
the summary, and the practice-goal handoff.

**Deferred to a follow-up (explicitly out of scope):**

- *Metric sanity layer.* Validating computed metrics before display (e.g. suppress
  wpm=0 when the transcript has words). The measured-metrics panel ships as-is.
- *Filler reclassification.* Treating discourse markers ("so", "like", "actually")
  by repetition/disruption rather than hard-flagging them. `FILLER_PHRASES` and the
  deterministic filler count are unchanged; the confidence reviewer simply stops
  surfacing them as coaching (fillers remain a measured metric only).

## Testing

- **Grounding gate.** An observation whose quote is not present in the transcript is
  dropped; a matching quote is kept with the correct `atSec`.
- **Thin sample.** A transcript that yields no grounded observations produces
  `evidenceState: "insufficient"`, `focus: null`, `more: []`.
- **Ranking.** With a missing core concept plus a teaching observation, the core gap
  becomes the focus.
- **Coverage plan-grounding.** A missing core concept produces a candidate without a
  transcript quote; a covered concept produces none.
- **Coach fallback.** When the coach LLM fails, the focus card is still built from the
  top observation (existing contained-failure pattern, mock provider offline).
- **Client mapping.** `reviewView` maps `focus`/`more` to cards with no score fields;
  the insufficient state renders the single line and no cards.
