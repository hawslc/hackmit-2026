# ai-review

Agentic AI review of a teaching-practice transcript. Takes an ElevenLabs Scribe
transcript (words + timestamps) plus an optional lesson plan, runs six narrow
reviewers in parallel, and returns a small set of grounded coaching cards.

## Reviewers

Five of the six share a scaffold (`reviewers/observation.ts`): same rules, same
`Observation[]` shape (category, quote, atSec, observation) — no scores, no
scoring category, just a quoted moment and what to do about it. `coverage` is the
exception, since its "evidence" is the lesson plan rather than a transcript quote.

| Section | What it looks for | Skipped when |
|---|---|---|
| **Delivery** | A quoted stretch that rambles, is verbose, or is unclear — wording only, not tone/pace/filler | — |
| **Coverage** | Lesson-plan concepts covered / partial / missing, by importance (core/supporting/optional); grounded in the plan, `quote: ""` | no lesson plan |
| **Teaching** | An abstract explanation missing a concrete example, a closed comprehension check, or unexplained jargon | — |
| **Structure** | A seam where lesson organization breaks — an abrupt topic jump or ending | — |
| **Engagement** | A genuinely open question (good) or a flat, one-directional stretch (bad) | — |
| **Confidence** | Hedging language ("I think maybe", "sort of") undercutting a claim the teacher could state plainly | — |

Every quote a reviewer returns is checked against the transcript before it can
become a card: `isQuoteGrounded()` / `locateQuoteSec()` (`src/transcript.ts`) do a
normalized substring match, falling back to word overlap, and anything that
doesn't verify is dropped. Coverage observations skip this check — they're
grounded by the lesson plan, not a transcript excerpt.

What survives grounding goes to `coach()` (`src/coach.ts`), which ranks by
category (`coverage > teaching > structure > engagement > delivery > confidence`),
keeps the top 4, and writes the final prose for a `focus` card plus up to 3
`more` cards. The LLM pass can rewrite headline/wording but never invents a
quote or timestamp — those are carried straight from the source observation. If
that LLM call fails, `coach()` falls back to the observations' own text.

Each reviewer call is contained: a throw or 30s timeout collapses to an empty
`[]` rather than surfacing an error, so one bad call just means fewer
observations — not a broken report.

## Run the demo (offline)

```bash
npm install
npm run demo -- demo/sample-transcript.json demo/sample-lesson-plan.md   # full report
npm run demo -- demo/sample-transcript.json                              # coverage skipped
```

`LLM_PROVIDER=mock` (the default) needs no API key. For the real model, copy
`.env.example` to `.env` and set `LLM_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`.

## Use from a backend

```ts
import { runReview } from "ai-review";           // src/index.ts

const review = await runReview(
  { words, lessonPlan },                          // ReviewRequest
  { model: "gpt-4o", timeoutMs: 30_000 },         // optional per-request overrides
);
// review: SessionReview  ->  return as JSON
```

`runReview(req, opts?)` is the only entry point. Env is read lazily, so importing
the module has no side effects.
The request and response contracts (`WordTiming`, `SessionReview`, `Concept`, …) live in
[`@cadence/shared`](../shared/src); this package only defines `ReviewRequest` and `ReviewOptions`.

## Layout

```
src/
  index.ts          public entry point
  orchestrate.ts    runReview: context → 6 reviewers in parallel → grounding filter → coach
  coach.ts          ranks grounded observations, writes the final cards (prompt, mock and
                    fallback live here)
  concepts.ts       extractConcepts (step 0, run at upload)
  context.ts        per-request data every reviewer needs
  transcript.ts     pure helpers over word timings, incl. isQuoteGrounded / locateQuoteSec
  llm/              infrastructure: config (env), completeJson, shared prompt fragments
  reviewers/        one file per reviewer; observation.ts holds the shared prompt/parsing
                    scaffold that delivery/teaching/structure/engagement/confidence all use
```

To tune a reviewer, open its file: the prompt (`LOOK_FOR`) and the canned mock output sit at the top.

## Tests

```bash
npm test    # node:test via tsx; runs offline against the mock provider
```
