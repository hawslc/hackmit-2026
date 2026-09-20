# Frontend Plan: Review Screen (UX owner)

## Context
After **Finish**, the TA should land on a simple Review page: which areas need the most work (with specific feedback), scores for the rest, the content the TA didn't cover, and anything they said that was untrue. Then a button back to Setup to practice again. Practice is still a stub and the server/`shared/` types aren't merged, so this is built against a mock behind an `api` module, exactly like Setup.

## Decisions agreed
- **Sections are a placeholder.** Use Speaking / Content / Teaching (from `docs/rubric.md`) for now. Everything that names them lives in one config, `lib/reviewSections.ts`, tagged `TODO: replace with the sections defined by the backend once it's merged`.
- **Highlighting:** always expand the **lowest 2** sections by score ("Needs the most work" badge, specific feedback with quotes). The rest show score + one-line summary. Fixed order (Speaking, Content, Teaching), never reshuffled. Errored/skipped sections aren't ranked.
- **Content gaps:** own block, every missing/partial concept listed with its source, neutral wording ("Not covered. Was that intentional?"). **Split:** core concepts under "Worth a second look", everything else collapsed under "Also not covered". Skipped with a note when there are no materials.
- **Factual errors:** checked against **materials + general knowledge**. Each item: the quote, why it's wrong, the correction, a label (`Contradicts your materials` | `Looks factually wrong`), and a **"Source" line linking what the LLM used to decide it was wrong**:
  - `materials` basis: label = file + location (e.g. `week3.pptx · slide 7`) with the matching excerpt quoted underneath. Uploaded files are local, so this is text, not a link.
  - `general` basis: label + `url` rendered as a link (`target="_blank" rel="noopener noreferrer"`). Only `http(s)` URLs become links; anything else shows as plain text. A missing source is shown as "No source provided" rather than hidden.
  - **Risk to flag to the AI owner:** an LLM without web access can invent URLs. The reviewer prompt should only allow a `url` when it comes from a search/retrieval tool or a well-known reference, and never fabricate one. The UI can't verify links. Placed **after content gaps**, in a red-outlined box, **only rendered when there are errors** (calm tone; not pinned to the top). If the check itself fails, show a small inline error, not silence.
- **Summary + top priority** header at the top. No transcript, no recording playback (later).
- **Loading:** full-screen "Reviewing your session…" then the full report. Total failure shows an error with **Retry** and **Back to setup**. Per-section failures render inline (design.md: "failures stay contained").
- **Practice again:** returns to Setup and **keeps materials + concepts** (already held in `App` via `useMaterialSetup`). The review is discarded.
- **Mock first:** `api/review.ts` with `VITE_USE_MOCK_API` (same flag as Setup), latency, and failure triggers.

## Flow
`Practice --Finish--> onFinish(CompletedSession) --> App view "review" --> ReviewScreen --> [Practice again] --> Setup`

## Types (`client/src/types.ts`, all marked `TODO: replace with shared`; announce to the AI owner)
```ts
CompletedSession   { transcript: string; durationSec: number }   // TODO(live): + words, metrics, recording
SectionId          "speaking" | "content" | "teaching"           // TODO(backend sections)
SectionResult<T>   { status:"ok"; data:T } | { status:"error"; message:string } | { status:"skipped"; reason:string }
SectionReview      { id: SectionId; score: number /*0-100*/; summary: string; feedback: { point: string; quote?: string }[] }
ContentGap         { concept: string; source?: string; importance?: number; status: "missing" | "partial" }
FactualIssue       { quote: string; problem: string; correction: string; basis: "materials" | "general";
                     source: { label: string; excerpt?: string; url?: string } }   // what the LLM used to judge it wrong
SessionReview      { summary: string; topPriority: string;
                     sections: SectionResult<SectionReview>[];
                     gaps: SectionResult<ContentGap[]>;
                     factualIssues: SectionResult<FactualIssue[]> }
```
- **Core vs. other:** derived client-side in one helper `isCoreGap()` = `importance >= 4`, or no importance (user-added concepts count as core: the TA said students must learn them). TODO: reconcile with the rubric's `core / supporting / optional` tags.

## Files
| File | Change |
|---|---|
| `client/src/types.ts` | Add the types above |
| `client/src/api/review.ts` (new) | `requestReview(material, session): Promise<SessionReview>`; real call `POST /api/review { material, transcript }` (strip `origin` via `toServerConcept`); mock builds gaps from `material.concepts` (first ones partial/missing; skipped if none), one factual issue with a source (a materials-based one if a file exists, else a general one with a link) |
| `client/src/lib/reviewSections.ts` (new) | Section titles/order (placeholder TODO) + `pickHighlighted(sections, 2)` + `isCoreGap()` |
| `client/src/hooks/useReview.ts` (new) | `{ status: loading/ready/error, review, retry }`; aborts/ignores stale results on unmount |
| `client/src/screens/ReviewScreen.tsx` (new) | `ReviewScreen({ material, session, onPracticeAgain })`; loading, error, report |
| `client/src/components/SectionCard.tsx` (new) | Expanded (highlighted) vs. compact (score only) variants, score pill |
| `client/src/components/ContentGaps.tsx` (new) | Core list + collapsed "Also not covered" (`<details>`) |
| `client/src/components/FactualIssues.tsx` (new) | Red-outlined box, hidden when empty |
| `client/src/screens/PracticeScreen.tsx` | `onFinish(session: CompletedSession)`; stub passes a fake session (transcript includes "1 + 2 = 4", `TODO(live)`) after stopping tracks |
| `client/src/App.tsx` | Add `{ name: "review"; session }` view; Practice again → `setView({name:"setup"})` |

Reuse: existing Tailwind tokens (`brand-*`, card style `rounded-2xl bg-white p-6 ring-1 ring-slate-200`), `toServerConcept`, the `USE_MOCK` / `sleep` / `jitter` / `errorMessage` pattern in `api/materials.ts` (extract `errorMessage`/`sleep` to a small shared `api/util.ts` only if duplicating them feels wrong).

## Page layout (top to bottom, single column, `max-w-xl` like Setup)
1. Header + summary + "Top priority" callout
2. Three section cards (lowest 2 expanded and badged)
3. Content gaps
4. Factual errors (only if any; red outline)
5. **Practice again** (primary button)

Tone: encouraging. Scores use indigo/emerald/amber, never red. Red is reserved for the factual-errors outline.

## Mock triggers (like Setup)
Filename contains `fail-review` → whole request fails; `fail-facts` → factual check errors inline; `no-facts` → no factual issues (block hidden); no concepts → gaps skipped.

## Out of scope
Transcript/recording playback, per-quote seeking, progressive per-section loading, the real endpoint and prompts (AI owner), real section definitions (backend TODO).

## Assumptions to confirm with teammates
- `POST /api/review` accepts `{ material, transcript }` and returns `SessionReview`; the fact-check reviewer is a new fourth reviewer, so `docs/rubric.md` needs a "Factual accuracy" section (AI owner).
- Live owner's `CompletedSession` will replace the stub shape.

## Verification
1. `npm run dev` in `client/`, mock on. Setup → Start → Finish → loading → report.
2. Lowest two of three sections are expanded with the badge; the third is compact. Gaps list matches the concepts from Setup (core first, others collapsed). The factual box appears after the gaps with the 1 + 2 = 4 item.
3. Files named `fail-review`, `fail-facts`, `no-facts`, and zero files each behave as described.
4. Practice again returns to Setup with files and concept chips intact; a second run works. Mic indicator is off on Review.
5. `npm run build` and `tsc` pass; check the layout at phone width.
