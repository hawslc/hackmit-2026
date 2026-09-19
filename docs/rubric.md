# Review rubric (draft)

The single source of truth for what each reviewer judges. Prompts in `server/src/review/*` and the
types in `shared/src/index.ts` follow this doc, so edit it first and then sync them.

A review has three sections, one reviewer each (see [design.md](design.md#ai-review-pipeline)).

## 1. Speaking score (delivery reviewer)

**Deterministic, not LLM-judged.** Measured in the browser, scored by `computeSpeakingScore`
in `shared/src/speakingScore.ts`. The LLM only turns the numbers into tips.

| Component | Measured from | Target band | Weight (draft) |
|---|---|---|---|
| Pace | Scribe word timestamps | ~130–160 WPM | 30% |
| Pauses | Gaps between words > 1.5s | Some after questions/key points; few mid-sentence | 15% |
| Filler words | Transcript ("um", "uh", "like", "so", "basically", "you know"…) | < ~3 per minute | 25% |
| Intonation | Web Audio pitch track (variation in semitones) | Not monotone | 20% |
| Volume | Web Audio RMS | Steady, not trailing off | 10% |

Each component scores 100 inside its band and falls off outside it. `overall` = weighted mean.

## 2. Content gaps (content reviewer)

All uploaded files (slides, PDFs, docs) are turned into one deduplicated concept list at upload
time. Each concept is tagged by how lost a
student would be without it:

- **core**: the lesson doesn't work without it
- **supporting**: helps understanding; fine to skip if short on time
- **optional**: extras, tangents, advanced asides

The content reviewer marks each concept **covered / partial / missing** from the transcript.
Paraphrases count as covered, and "covered" needs a quote as evidence.

**Tone: gaps are not failures.** A TA doesn't need to cover everything. Only missing *core*
concepts are worth flagging hard. Optional gaps read as FYI ("fine to skip for an intro").

## 3. Teaching skills (teaching reviewer)

Scored 1–5 from the transcript, with a quote as evidence for each score. This is what makes us
more than a speaking-practice app.

### accessible_language: can a student who's behind follow this?

- Defines jargon before (or instead of) using it
- Short sentences; one idea at a time
- Builds from what students already know ("Remember last week when…")
- **Red flags:** undefined acronyms, stacked technical terms, "obviously" / "trivially"

### analogies_examples: does the abstract idea get made concrete?

- At least one concrete example per new concept
- Analogies that map onto the structure of the concept, not just its surface
- Worked example before the general rule, where possible
- **Red flags:** only abstract definitions; an analogy that breaks on the key point

### checks_for_understanding: are students made to think?

- Asks open questions ("Why do you think…?", "What would happen if…?")
- Asks students to justify or predict, not just recall
- Pauses after a question (visible as a long pause right after a `?`)
- **Red flags:** "Any questions?" / "Make sense?" as the only check; answering own question immediately

## Summary + top priority (synthesizer)

Reads all three sections and picks **one** thing to work on next. Preference order:
missing core concept > lowest teaching score > weakest speaking component.

## Later ideas (not in MVP)

- **Content quality:** conciseness, clarity, logical flow of ideas
- **Responding to questions:** a simulated student (ElevenLabs voice agent) asks a follow-up, and the answer gets graded
