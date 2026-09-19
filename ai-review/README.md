# ai-review

Agentic AI review of a teaching-practice transcript. Takes an ElevenLabs Scribe
transcript (words + timestamps) plus an optional lesson plan, runs several narrow
reviewers in parallel, and returns one structured report.

## Reviewers

| Section | What it judges | Skipped when |
|---|---|---|
| **Delivery** | Word-level clarity & conciseness (rambling / verbose / unclear moments) | — |
| **Coverage** | Lesson-plan concepts covered / partial / missing, by importance | no lesson plan |
| **Teaching** | `accessible_language`, `analogies_examples`, `checks_for_understanding` (1–5) | — |
| **Structure** | Lesson-level ordering, intro, transitions, recap | — |
| **Engagement** | Interactivity, questions, energy | — |
| **Confidence** | Hedging + filler words (fillers/min is measured, not LLM-judged) | — |

A synthesizer then writes the summary and picks one top priority
(missing core concept > lowest teaching score > delivery/structure issue).

Each reviewer is contained: a throw or 30s timeout becomes an inline
`{status:"error"}` section instead of blanking the report.

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
the module has no side effects. Types live in `src/types.ts`.
