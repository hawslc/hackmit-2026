# Review rubric (draft)

The single source of truth for what each reviewer judges. Prompts in
`ai-review/src/reviewers/*.ts` and the types in `shared/src/review.ts` follow this doc, so edit
it first and then sync them.

A review has the deterministic speaking score plus six independent reviewers (see
[design.md](design.md#ai-review-pipeline)).

## 1. Speaking score (deterministic, not LLM-judged)

Measured in the browser, scored by `computeSpeakingScore` in `shared/src/speakingScore.ts`. No
reviewer sees or writes to this score — the "delivery" reviewer below is a separate, LLM-judged
category that looks at wording, not these numbers.

| Component | Measured from | Target band | Weight (draft) |
|---|---|---|---|
| Pace | Scribe word timestamps | ~130–160 WPM | 30% |
| Pauses | Gaps between words > 1.5s | Some after questions/key points; few mid-sentence | 15% |
| Filler words | Transcript ("um", "uh", "like", "so", "basically", "you know"…) | < ~3 per minute | 25% |
| Intonation | Web Audio pitch track (variation in semitones) | Not monotone | 20% |
| Volume | Web Audio RMS | Steady, not trailing off | 10% |

Each component scores 100 inside its band and falls off outside it. `overall` = weighted mean.

## 2. Coverage reviewer

All uploaded files (slides, PDFs, docs) are turned into one deduplicated concept list at upload
time. Each concept is tagged by how lost a student would be without it:

- **core**: the lesson doesn't work without it
- **supporting**: helps understanding; fine to skip if short on time
- **optional**: extras, tangents, advanced asides

The coverage reviewer marks each concept **covered / partial / missing** from the transcript.
Paraphrases count as covered. Unlike every other reviewer, a coverage observation carries no
transcript quote (`quote: ""`) — it's grounded by the lesson plan itself, not an excerpt.

**Tone: gaps are not failures.** A TA doesn't need to cover everything. Only missing *core*
concepts are worth flagging hard. Optional gaps read as FYI ("fine to skip for an intro").

## 3. Delivery reviewer

Judges wording clarity and conciseness only — not tone, pace, filler, or confidence, which have
their own reviewers below. Surfaces a quoted stretch that:

- **rambles**: a long run-on that loses the point
- **is verbose**: many words for a simple idea, or repeats itself
- **is unclear**: a sentence a student would struggle to parse

## 4. Teaching reviewer

No scores. Surfaces at most 3 grounded moments where:

- an explanation was abstract exactly where a concrete example would land, or
- a check for understanding was so closed a student could pass it without reasoning
  (e.g. "make sense?"), or
- a technical term was used without being made accessible

This is what makes us more than a speaking-practice app, but each item is a quoted moment with a
suggested better move — not a 1–5 rating.

## 5. Structure reviewer

Judges lesson-level organization, not sentence phrasing. Surfaces a quoted seam where the
organization breaks: a jump into a topic with no transition or setup, or an abrupt ending.

## 6. Engagement reviewer

Judges how interactive the teaching is. Surfaces either a genuinely open question that invites
thinking, or a flat monologue stretch where students are only talked at. A single broad "anything
else?" counts as weak, not as strong engagement.

## 7. Confidence reviewer

Flags hedging language that undercuts authority — a quoted phrase like "I think maybe", "sort
of", "I guess", "probably" attached to something the teacher could state plainly. Discourse
markers ("okay", "so", "like") are not hedging and are left to the fillers-per-minute metric,
not this reviewer.

## Ranking + coaching cards (coach)

Every reviewer (but coverage) must quote the transcript verbatim, and every quote is re-checked
against the transcript (`isQuoteGrounded`) before it's allowed through — grounding, not
self-report, is what keeps a reviewer honest. What survives is ranked by category —
`coverage > teaching > structure > engagement > delivery > confidence` — and the top 4 become one
`focus` card plus up to 3 `more` cards. One LLM pass can rewrite the headline and prose for each
card, but never the quote or timestamp, which are carried straight from the grounded observation.
If that LLM call fails, the cards fall back to the observations' own text rather than erroring out.

## Later ideas (not in MVP)

- **Content quality:** conciseness, clarity, logical flow of ideas
- **Responding to questions:** a simulated student (ElevenLabs voice agent) asks a follow-up, and the answer gets graded
