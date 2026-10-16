# Design

## Pitch

Practice teaching, get reviewed like a mentor would. A TA uploads their lecture materials
(slides, PDFs, docs, notes), clicks **Start practice**, and teaches out loud. The app records
and transcribes as they go, with live meters for pace, fillers and intonation. When they finish,
AI reviewers return a **speaking score** and a small set of **coaching cards** — one focus card
plus up to three more — each grounded in something the TA actually said (or, for a missed core
idea, in their own lesson plan). The recording plays back alongside.

- **Track:** Education
- **Challenges we're aiming at:** ElevenLabs (Scribe v2 Realtime transcription, plus the voice-agent
  stretch), Meta (Llama API runs the reviewers; human connection = better teachers), Ramp (TA
  training time saved)

## User flow

1. **Upload materials** (optional): up to 5 lecture files. The app shows the key ideas it found.
2. **Click "Start practice".** This one click starts the session: the browser asks for mic
   access (first time only), then recording and live transcription begin right away. The TA
   teaches out loud while live meters show pace, fillers and intonation.
3. **Click "Finish".** Recording stops and the session goes to review.
4. **Review:** speaking score, a focus coaching card plus up to three more, and the recording,
   played back next to the transcript.

## Inputs → outputs

The TA provides only the materials and the practice itself. Audio and the transcript are
**captured by the app** during the session; the TA never uploads a recording or a transcript.

| What the TA provides | What the app captures during practice | Outputs |
|---|---|---|
| Up to 5 lecture files: slides (.pptx, incl. speaker notes), PDF, Word (.docx), .txt, .md | Audio recording (MediaRecorder, from "Start practice" to "Finish") | **Speaking score** 0–100 (deterministic): pace, pauses, fillers, intonation, volume |
| Teaching out loud after clicking "Start practice" | Live transcript with word timestamps (Scribe) | **Coaching cards**: one focus card plus up to 3 more, each tagged by category (delivery, coverage, teaching, structure, engagement, or confidence), grounded in a transcript quote and timestamp (or, for a missed core idea, in the lesson plan) |
| | Delivery metrics: pace, pauses, fillers, pitch, volume | Each card: headline, what happened, why it matters, a line to try instead, and a practice goal |
| | | Playback of the recording alongside the transcript |

## Scope

| | Feature |
|---|---|
| **MVP** | Multi-file materials upload (≤5: pptx, pdf, docx, txt, md) → one deduplicated concept list |
| **MVP** | One-click "Start practice" → recording + live transcript + live delivery meters; "Finish" → review |
| **MVP** | AI review: speaking score plus a focus coaching card and up to 3 more, each grounded in a transcript quote or the lesson plan |
| **Stretch** | Simulated student: ElevenLabs voice agent asks a follow-up; TA's answer is graded |
| **Stretch** | Live concept checklist that ticks off as the TA covers ideas |
| **Stretch** | Click a quote in the review to seek the recording to that moment |
| **Later** | Content quality: conciseness, clarity, flow |

## Architecture

Browser-heavy client, thin server. The server holds all API keys and runs the AI steps.

```
SETUP        each file ──► POST /api/materials/file ──► extract text ──► SourceFile   (≤5, in parallel)
             all files ──► POST /api/materials/concepts ──► extractConcepts (LLM) ──► Concept[]
                                                 client holds LectureMaterial { files[], concepts[] }

PRACTICE     [Start practice] ─► useMicrophone ─► one MediaStream ─┬─► Scribe v2 Realtime (token from /api/scribe-token)
             (one click starts                                    │      └─► words + timestamps ─► metrics.ts (WPM, pauses, fillers)
              everything)                                         ├─► useAudioFeatures (Web Audio: pitch, volume)
                                                                  └─► useRecorder (MediaRecorder → Blob for playback)
                                                                        ▼
                                                            live meters + live speaking score

             [Finish] ─► stop Scribe + recorder, release mic ─► CompletedSession { transcript, words, metrics, recording }

REVIEW       automatic on Finish: POST /api/review { material, transcript, words, metrics } ──► review pipeline ──► SessionReview
```

- The browser talks to Scribe directly, so the live loop has no extra hop through our server.
- The recording stays in the browser, used only for playback. The reviewers work from the
  transcript and metrics, which are much cheaper and faster to send than audio.
- Uploads go one file per request, so each file shows its own progress or error and can be
  removed alone. Concepts are extracted once across the whole set, so the same idea on a slide and
  in the notes becomes one concept.
- The server keeps no state. The client holds `LectureMaterial` and sends it back with the review
  request, so there's no database.

## AI review pipeline

```
                 ┌─► delivery     wording/clarity moments ──┐
                 ├─► coverage     concepts × transcript ─────┤
ReviewRequest ───┼─► teaching     explanation moments ───────┤   (each reviewer: Observation[],
                 ├─► structure    opening/transitions/close ─┤    no scores — 30s timeout, a
                 ├─► engagement   questions/examples ────────┤    throw or timeout → [])
                 └─► confidence   hedging/filler moments ────┘
                                        │ flatten
                                        ▼
                               grounding filter ──► drop any quote not actually in the transcript
                                        │ (coverage items are plan-grounded, skipped instead)
                                        ▼
                                     coach() ──► rank by category, take top 4, write cards (LLM
                                                 rewrites prose; quote/timestamp always come from
                                                 the source observation, never the LLM)
                                        ▼
                                SessionReview { focus, more[] }
```

Plus **step 0**, run at upload rather than at review: `extractConcepts` turns all the uploaded
files into the concept checklist the coverage reviewer grades against. Each concept records
where it came from (e.g. `week3.pptx · slide 7`).

**Design decisions:**
- **Six narrow reviewers, not one big prompt.** Each has one job and its own prompt
  (`ai-review/src/reviewers/*.ts`), so each can be tuned and tested alone. They run in parallel
  (`Promise.all`), so the wait is only as long as the slowest one.
- **Reviewers observe, they don't score or rank.** Every reviewer (but `coverage`) returns plain
  `Observation[]` — a quote, a timestamp, a category, nothing else. No reviewer sees another's
  output, and none of them score teaching quality on a scale; `coach()` is the only step that
  ranks or writes final prose.
- **Every quote is verified before it can become a card.** `isQuoteGrounded()`
  (`ai-review/src/transcript.ts`) checks each observation's quote actually appears in the
  transcript (substring match, with a word-overlap fallback) before it reaches `coach()`. An
  observation that fails this check is dropped, not shown with a caveat.
- **Numbers come from measurement, judgment from the LLM.** The speaking score is computed
  (`shared/speakingScore.ts`, the same function the live meter uses) — no LLM involved. LLMs only
  judge what needs judgment: which moments are worth surfacing, and how to phrase a card.
- **Concepts are extracted once, at upload.** The TA sees what they'll be graded against before
  starting, and every attempt is graded against the same list, so attempts are comparable.
- **Failures stay contained, quietly.** Each reviewer call is wrapped in a 30s timeout; a throw or
  timeout collapses to an empty `[]` rather than surfacing an error — the rest of the reviewers'
  observations still flow into `coach()`. No lesson plan means the coverage reviewer is skipped
  the same way.
- **One LLM helper.** Every step calls `completeJson()` in `ai-review/src/llm/client.ts`. OpenAI and
  Llama both use the OpenAI chat API, so `LLM_PROVIDER` switches between them.
- **Mock mode.** `LLM_PROVIDER=mock` gives each reviewer canned output and skips the grounding
  filter. The UI can be built with no keys, and it doubles as the demo fallback.

Prompting rules for every reviewer (`OBSERVATION_RULES` in
`ai-review/src/reviewers/observation.ts`):
- Output JSON only.
- Every item must quote the transcript verbatim — no paraphrasing.
- Never reward or penalize the absence of something; only report a moment that's actually there.
- An empty list is a correct answer when nothing grounded is found.
- Don't score, rank, summarize, or compare categories — that's `coach()`'s job. At most 3
  observations per reviewer.

## Reading lecture files

`server/src/extract/` turns every supported format into text, using markdown headings
(`## Slide 3`, `## Page 2`) so the LLM can cite sources.

| Format | How | Notes |
|---|---|---|
| `.pptx` (and Google Slides → Download → .pptx) | Unzip (fflate), read slide XML | Presentation order (not file order), hidden slides skipped, **speaker notes included**, tables included |
| `.pdf` (incl. slide decks exported to PDF) | unpdf (pdf.js) | One section per page. Scanned/image-only PDFs have no text and are rejected with a message. |
| `.docx` | Unzip, read `word/document.xml` | Paragraph text |
| `.txt`, `.md` | UTF-8 | |
| `.ppt`, `.key`, `.doc`, `.pages` | Rejected | The error says how to export to a supported format |

Limits (`UPLOAD_LIMITS` in shared): 5 files, 20 MB each, 60k characters of text per file
(beyond that the file is truncated and the UI says so). File type is checked by magic bytes too,
so renamed files get a clear error.

## Contracts

All client↔server types live in [`shared/src/index.ts`](../shared/src/index.ts). Changing one breaks
the other side at compile time. Announce changes in the team chat.
