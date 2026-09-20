# Grounded Coaching Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six-rubric-box review output with one grounded coaching focus plus progressive-disclosure detail, gated so a thin sample produces nothing instead of confident nonsense.

**Architecture:** Reviewers keep running but each now returns a uniform `Observation[]` (every item anchored to a verbatim quote). The orchestrator collects observations, drops any whose quote isn't found in the transcript, ranks them, and a single coach step turns the top observations into `CoachingCard`s (`focus` + `more`). The client renders those cards directly — no scores, no summary, no per-section rendering.

**Tech Stack:** TypeScript, Node's built-in test runner via `tsx --test` (ai-review + client), React 19 + Vite + Tailwind (client), Express (server, passthrough — no changes).

**Spec:** `docs/superpowers/specs/2026-09-19-grounded-coaching-layer-design.md`

---

## File structure

**shared/**
- `src/review.ts` — MODIFY: new `CoachingCategory`, `CoachingCard`, `SessionReview`; keep `WordTiming`, `ReviewRequestBody`, `ConceptImportance`, `CoverageStatus`; delete all per-reviewer output types and `FactualIssue`.

**ai-review/**
- `src/types.ts` — MODIFY: add internal `Observation`.
- `src/transcript.ts` — MODIFY: add `isQuoteGrounded`.
- `src/reviewers/observation.ts` — CREATE: shared prompt block + `observationPrompt` + `parseObservations`.
- `src/reviewers/{delivery,teaching,structure,engagement,confidence,coverage}.ts` — MODIFY: return `Observation[]`.
- `src/coach.ts` — CREATE: `rankObservations` + `coach` (replaces `synthesize.ts`).
- `src/synthesize.ts` — DELETE.
- `src/orchestrate.ts` — MODIFY: collect → validate → coach.
- `demo/run.ts` — MODIFY: print `focus`/`more`.
- `test/orchestrate.test.ts` — MODIFY: assert new shape.
- `test/coach.test.ts`, `test/observation.test.ts` — CREATE.

**client/**
- `src/types.ts` — MODIFY: drop the review view-model types.
- `src/hooks/useReview.ts` — MODIFY: return raw `SessionReview`.
- `src/components/CoachingCardView.tsx` — CREATE.
- `src/components/SectionCard.tsx`, `src/components/FactualIssues.tsx`, `src/lib/reviewView.ts`, `test/reviewView.test.ts` — DELETE.
- `src/screens/ReviewScreen.tsx` — MODIFY: render cards, strip chrome.
- `src/App.tsx`, `src/screens/PracticeScreen.tsx` — MODIFY: practice-goal handoff.
- `test/labels.test.ts` — CREATE (keeps the client test glob non-empty).

---

## Task 1: New shared contract

**Files:**
- Modify: `shared/src/review.ts`

- [ ] **Step 1: Replace the whole file**

Replace the entire contents of `shared/src/review.ts` with:

```ts
// Review: POST /api/review. The response is a small set of grounded coaching
// cards. Every card traces to a real moment in the session; `atSec` lets the UI
// label (and later seek to) that moment.

/** One word from Scribe's `committed_transcript_with_timestamps`. Times in seconds from session start. */
export interface WordTiming {
  text: string;
  start: number;
  end: number;
}

import type { ReviewMaterial } from "./materials.ts";

/** Body of POST /api/review. */
export interface ReviewRequestBody {
  words: WordTiming[];
  /** When absent (or without any text or concepts), the coverage reviewer is skipped. */
  material?: ReviewMaterial;
}

/** Importance/status kept for the coverage reviewer's internal concept checklist. */
export type ConceptImportance = "core" | "supporting" | "optional";
export type CoverageStatus = "covered" | "partial" | "missing";

/** Which reviewer surfaced a card — used only for the card's label. */
export type CoachingCategory =
  | "delivery"
  | "coverage"
  | "teaching"
  | "structure"
  | "engagement"
  | "confidence";

/** One grounded, actionable coaching item. */
export interface CoachingCard {
  category: CoachingCategory;
  /** 2–4 word title, e.g. "Stronger questions". */
  headline: string;
  /** Verbatim transcript quote, validated server-side. Empty only for plan-grounded coverage gaps. */
  quote: string;
  /** Seconds from session start of the quoted moment (0 for plan-grounded gaps). */
  atSec: number;
  /** Neutral description of what happened. */
  whatHappened: string;
  /** One sentence on why it matters. */
  whyItMatters: string;
  /** A concrete line the user could say next time. */
  tryInstead: string;
  /** The retry target carried into the next practice session. */
  practiceGoal: string;
}

/** Response of POST /api/review. */
export interface SessionReview {
  /** "insufficient" → nothing cleared the evidence bar; the UI shows a single honest line. */
  evidenceState: "coached" | "insufficient";
  /** The one main thing to work on; null when insufficient. */
  focus: CoachingCard | null;
  /** Additional grounded cards for progressive disclosure (0..3). */
  more: CoachingCard[];
}
```

- [ ] **Step 2: Typecheck shared**

Run: `npm -w shared run typecheck` (falls back to `npx -w shared tsc --noEmit` if no script)
Expected: shared compiles. (Other packages will not compile yet — that's expected until later tasks.)

- [ ] **Step 3: Commit**

```bash
git add shared/src/review.ts
git commit -m "feat(shared): replace section contract with CoachingCard/SessionReview"
```

---

## Task 2: Internal Observation type

**Files:**
- Modify: `ai-review/src/types.ts`

- [ ] **Step 1: Append the Observation type**

Add to the end of `ai-review/src/types.ts`:

```ts
import type { CoachingCategory } from "@cadence/shared";

/** A single grounded finding from one reviewer. The coach ranks a pool of these. */
export interface Observation {
  category: CoachingCategory;
  /** Verbatim transcript quote. Empty only when planGrounded is true. */
  quote: string;
  /** Resolved server-side from the quote; 0 for plan-grounded gaps. */
  atSec: number;
  /** Neutral: what happened. */
  observation: string;
  /** One sentence on why it matters. */
  whyItMatters: string;
  /** Optional seed the coach may refine into `tryInstead`. */
  suggestion?: string;
  /** True for coverage gaps grounded in the lesson plan (no transcript quote to validate). */
  planGrounded?: boolean;
}
```

> Note: `ai-review/src/types.ts` already imports `WordTiming` from `@cadence/shared` at the top. Merge the `CoachingCategory` import into that existing import line rather than adding a duplicate `import ... from "@cadence/shared"`.

- [ ] **Step 2: Commit**

```bash
git add ai-review/src/types.ts
git commit -m "feat(ai-review): add internal Observation type"
```

---

## Task 3: Quote-grounding check

**Files:**
- Modify: `ai-review/src/transcript.ts`
- Test: `ai-review/test/observation.test.ts` (created here, extended in Task 5)

- [ ] **Step 1: Write the failing test**

Create `ai-review/test/observation.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isQuoteGrounded, splitSentences } from "../src/transcript.ts";
import type { WordTiming } from "@cadence/shared";

const words: WordTiming[] = "Recursion is when a function calls itself until it stops."
  .split(" ")
  .map((text, i) => ({ text, start: i * 0.4, end: i * 0.4 + 0.35 }));
const segments = splitSentences(words);

describe("isQuoteGrounded", () => {
  it("accepts a verbatim substring of the transcript", () => {
    assert.equal(isQuoteGrounded("a function calls itself", segments), true);
  });

  it("accepts a near-match sharing enough words (punctuation/case differ)", () => {
    assert.equal(isQuoteGrounded("Recursion is when a function CALLS itself!", segments), true);
  });

  it("rejects a quote the transcript never contains", () => {
    assert.equal(isQuoteGrounded("let's compute factorial of three", segments), false);
  });

  it("rejects an empty quote", () => {
    assert.equal(isQuoteGrounded("", segments), false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm -w ai-review test`
Expected: FAIL — `isQuoteGrounded` is not exported.

- [ ] **Step 3: Implement `isQuoteGrounded`**

Add to `ai-review/src/transcript.ts` (after `locateQuoteSec`; it reuses the file-private `normalize2` and `words2`):

```ts
/**
 * True when the quote is actually present in the transcript: an exact normalized
 * substring of some segment, or sharing at least `min(3, quoteWords)` words with
 * one. This is the grounding gate — ungrounded LLM quotes are dropped upstream.
 */
export function isQuoteGrounded(quote: string, segments: Segment[]): boolean {
  const q = normalize2(quote);
  if (!q) return false;
  for (const seg of segments) {
    if (normalize2(seg.text).includes(q)) return true;
  }
  const qWords = words2(quote);
  if (qWords.length === 0) return false;
  const qSet = new Set(qWords);
  let best = 0;
  for (const seg of segments) {
    let overlap = 0;
    for (const w of words2(seg.text)) if (qSet.has(w)) overlap++;
    if (overlap > best) best = overlap;
  }
  return best >= Math.min(3, qWords.length);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm -w ai-review test`
Expected: PASS (the new `isQuoteGrounded` block; other suites still reference old types and may fail to compile — that is fixed in later tasks. If the whole file fails to load, proceed; Task 12 makes the suite green).

> If `npm -w ai-review test` won't even start because `orchestrate.test.ts` references removed types, temporarily run only this file: `npx -w ai-review tsx --test test/observation.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add ai-review/src/transcript.ts ai-review/test/observation.test.ts
git commit -m "feat(ai-review): add isQuoteGrounded grounding gate"
```

---

## Task 4: Shared observation prompt scaffolding

**Files:**
- Create: `ai-review/src/reviewers/observation.ts`

- [ ] **Step 1: Create the file**

Create `ai-review/src/reviewers/observation.ts`:

```ts
// Shared scaffolding for the grounded reviewers. Every reviewer (except coverage,
// which is plan-grounded) returns the same shape via `parseObservations`, and shares
// one rule block so "grounded, no absence-blaming, empty is fine" lives in one place.

import type { CoachingCategory } from "@cadence/shared";
import type { Observation } from "../types.ts";
import { type Prompt, transcriptBlock } from "../llm/prompt.ts";
import { locateQuoteSec, type Segment } from "../transcript.ts";

export const OBSERVATION_RULES = `You are one specialist reviewer. Surface only GROUNDED moments — specific things the speaker actually said, each anchored to a verbatim quote copied from the transcript.
Rules:
- Every item MUST quote the transcript verbatim, and that quote alone must demonstrate the behavior. If it doesn't, drop the item.
- Never reward or penalize absence. No "you didn't…", "consider adding…", "develop a plan…". Only flag a missing behavior when you can quote the specific moment that would clearly have been better with it.
- If you find no grounded moment, return an empty list. For short clips that is the correct answer.
- Do not score, rank, summarize, or compare categories — a later step does that. Return at most 3 of your clearest moments.
Return a single JSON object and nothing else:
{ "observations": [ { "quote": string, "observation": string, "whyItMatters": string, "suggestion": string } ] }`;

/** Build the standard reviewer prompt: role/look-for line + shared rules, then the transcript. */
export function observationPrompt(lookFor: string, transcript: string, preamble = ""): Prompt {
  return {
    system: `${lookFor}\n\n${OBSERVATION_RULES}`,
    user: `${preamble}${transcriptBlock(transcript)}`,
  };
}

interface RawObservation {
  quote?: string;
  observation?: string;
  whyItMatters?: string;
  suggestion?: string;
}
export interface RawObservations {
  observations?: RawObservation[];
}

/** Normalize the model's raw JSON into Observations. `atSec` is resolved here, never trusted from the LLM. */
export function parseObservations(
  raw: RawObservations,
  category: CoachingCategory,
  segments: Segment[],
): Observation[] {
  return (raw.observations ?? [])
    .filter((o): o is RawObservation & { quote: string } => Boolean(o?.quote))
    .slice(0, 3)
    .map((o) => ({
      category,
      quote: o.quote,
      atSec: locateQuoteSec(o.quote, segments),
      observation: o.observation ?? "",
      whyItMatters: o.whyItMatters ?? "",
      suggestion: o.suggestion || undefined,
    }));
}
```

- [ ] **Step 2: Typecheck**

Run: `npx -w ai-review tsc --noEmit`
Expected: this file compiles (reviewers still reference old types — fixed next).

- [ ] **Step 3: Commit**

```bash
git add ai-review/src/reviewers/observation.ts
git commit -m "feat(ai-review): shared grounded-observation prompt + parser"
```

---

## Task 5: Parser unit test

**Files:**
- Modify: `ai-review/test/observation.test.ts`

- [ ] **Step 1: Append the failing test**

Add to `ai-review/test/observation.test.ts`:

```ts
import { parseObservations } from "../src/reviewers/observation.ts";

describe("parseObservations", () => {
  it("drops items without a quote, resolves atSec, caps at 3", () => {
    const raw = {
      observations: [
        { quote: "a function calls itself", observation: "o1", whyItMatters: "w1", suggestion: "s1" },
        { observation: "no quote", whyItMatters: "w" },
        { quote: "until it stops", observation: "o2", whyItMatters: "w2" },
        { quote: "Recursion is when", observation: "o3", whyItMatters: "w3" },
        { quote: "extra", observation: "o4", whyItMatters: "w4" },
      ],
    };
    const out = parseObservations(raw, "teaching", segments);
    assert.equal(out.length, 3);
    assert.equal(out[0]!.category, "teaching");
    assert.equal(out[0]!.quote, "a function calls itself");
    assert.equal(typeof out[0]!.atSec, "number");
    assert.equal(out[1]!.quote, "until it stops"); // the un-quoted item was dropped
    assert.equal(out[1]!.suggestion, undefined);
  });
});
```

- [ ] **Step 2: Run and verify it passes**

Run: `npx -w ai-review tsx --test test/observation.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add ai-review/test/observation.test.ts
git commit -m "test(ai-review): parseObservations drops, resolves, caps"
```

---

## Task 6: Delivery reviewer → Observation[]

**Files:**
- Modify: `ai-review/src/reviewers/delivery.ts`

- [ ] **Step 1: Replace the whole file**

Replace the entire contents of `ai-review/src/reviewers/delivery.ts` with:

```ts
// Delivery: word-level clarity & conciseness only (no fillers/tone/pace).

import type { ReviewContext } from "../context.ts";
import type { Observation } from "../types.ts";
import { completeJson } from "../llm/client.ts";
import { isMock } from "../llm/config.ts";
import { observationPrompt, parseObservations, type RawObservations } from "./observation.ts";

const LOOK_FOR = `You are a delivery coach judging ONLY the clarity and conciseness of a teacher's wording.
Judge from the words themselves. Do NOT comment on filler words, tone, volume, pace, or confidence — other reviewers handle those.
Surface a quoted stretch that genuinely rambles (a long run-on that loses the point), is verbose (many words for a simple idea, or repeats itself), or is unclear (a sentence a student would struggle to parse).`;

const mockDelivery: Observation[] = [
  {
    category: "delivery",
    quote:
      "So recursion is basically when a function, like, calls itself, and it keeps calling itself over and over until, you know, eventually it stops at some point",
    atSec: 12,
    observation: "This sentence runs on and buries the definition in filler.",
    whyItMatters: "A tight definition is easier for a first-timer to hold onto.",
    suggestion: "Recursion is when a function calls itself until it hits a stopping condition.",
  },
];

export async function reviewDelivery(ctx: ReviewContext): Promise<Observation[]> {
  if (isMock(ctx.cfg)) return mockDelivery;

  const { system, user } = observationPrompt(LOOK_FOR, ctx.timestamped);
  const raw = await completeJson<RawObservations>({ task: "delivery-review", system, user }, ctx.cfg);
  return parseObservations(raw, "delivery", ctx.segments);
}
```

- [ ] **Step 2: Commit**

```bash
git add ai-review/src/reviewers/delivery.ts
git commit -m "refactor(ai-review): delivery reviewer returns Observation[]"
```

---

## Task 7: Teaching reviewer → Observation[]

**Files:**
- Modify: `ai-review/src/reviewers/teaching.ts`

- [ ] **Step 1: Replace the whole file**

Replace the entire contents of `ai-review/src/reviewers/teaching.ts` with:

```ts
// Teaching skills: grounded moments only — no scores.

import type { ReviewContext } from "../context.ts";
import type { Observation } from "../types.ts";
import { completeJson } from "../llm/client.ts";
import { isMock } from "../llm/config.ts";
import { observationPrompt, parseObservations, type RawObservations } from "./observation.ts";

const LOOK_FOR = `You review teaching skill from the transcript. Surface a quoted moment where:
- an explanation was abstract exactly where a concrete example would land, or
- a check for understanding was so closed a student could pass it without reasoning (e.g. "make sense?"), or
- a technical term was used without being made accessible.
Only from real quotes. Do NOT give scores or grade categories — just the grounded moment and a better move.`;

const mockTeaching: Observation[] = [
  {
    category: "teaching",
    quote: "does that make sense to everyone?",
    atSec: 88,
    observation: "The only comprehension check is a yes/no question a student can pass without reasoning.",
    whyItMatters: "Closed checks don't reveal whether anyone actually followed the idea.",
    suggestion: "Ask an open prompt like \"What would happen if we removed the base case?\" then wait 3–5 seconds.",
  },
];

export async function reviewTeaching(ctx: ReviewContext): Promise<Observation[]> {
  if (isMock(ctx.cfg)) return mockTeaching;

  const { system, user } = observationPrompt(LOOK_FOR, ctx.timestamped);
  const raw = await completeJson<RawObservations>({ task: "teaching-review", system, user }, ctx.cfg);
  return parseObservations(raw, "teaching", ctx.segments);
}
```

- [ ] **Step 2: Commit**

```bash
git add ai-review/src/reviewers/teaching.ts
git commit -m "refactor(ai-review): teaching reviewer returns Observation[], no scores"
```

---

## Task 8: Structure reviewer → Observation[]

**Files:**
- Modify: `ai-review/src/reviewers/structure.ts`

- [ ] **Step 1: Replace the whole file**

Replace the entire contents of `ai-review/src/reviewers/structure.ts` with:

```ts
// Clarity & structure: lesson-level organization (macro), distinct from delivery.

import type { ReviewContext } from "../context.ts";
import type { Observation } from "../types.ts";
import { completeJson } from "../llm/client.ts";
import { isMock } from "../llm/config.ts";
import { observationPrompt, parseObservations, type RawObservations } from "./observation.ts";

const LOOK_FOR = `You judge LESSON-LEVEL structure, not sentence phrasing.
Surface a quoted seam where the organization breaks: a jump into a topic with no transition or setup, or an abrupt ending. Quote the exact moment the seam shows.`;

const mockStructure: Observation[] = [
  {
    category: "structure",
    quote: "okay so let's compute factorial of 3",
    atSec: 58,
    observation: "The example starts with no bridge from the definition that preceded it.",
    whyItMatters: "A one-line bridge tells students why this example comes next.",
    suggestion: "Add: \"Let's see this with the simplest example — factorial.\"",
  },
];

export async function reviewStructure(ctx: ReviewContext): Promise<Observation[]> {
  if (isMock(ctx.cfg)) return mockStructure;

  const { system, user } = observationPrompt(LOOK_FOR, ctx.timestamped);
  const raw = await completeJson<RawObservations>({ task: "structure-review", system, user }, ctx.cfg);
  return parseObservations(raw, "structure", ctx.segments);
}
```

- [ ] **Step 2: Commit**

```bash
git add ai-review/src/reviewers/structure.ts
git commit -m "refactor(ai-review): structure reviewer returns Observation[]"
```

---

## Task 9: Engagement reviewer → Observation[]

**Files:**
- Modify: `ai-review/src/reviewers/engagement.ts`

- [ ] **Step 1: Replace the whole file**

Replace the entire contents of `ai-review/src/reviewers/engagement.ts` with:

```ts
// Engagement: interactivity, questions, energy — the human-connection angle.

import type { ReviewContext } from "../context.ts";
import type { Observation } from "../types.ts";
import { completeJson } from "../llm/client.ts";
import { isMock } from "../llm/config.ts";
import { observationPrompt, parseObservations, type RawObservations } from "./observation.ts";

const LOOK_FOR = `You judge how engaging and interactive the teaching is.
Surface a quoted moment: a genuinely open question that invites thinking, OR a flat monologue stretch where students are only talked at. Note that a single broad "anything else?" is a WEAK check, not strong engagement.`;

const mockEngagement: Observation[] = [
  {
    category: "engagement",
    quote: "so we just keep going and going and going through each number",
    atSec: 70,
    observation: "A long stretch of one-directional narration with nothing asked of the listener.",
    whyItMatters: "A quick call-and-response here would keep students actively predicting.",
    suggestion: "Pause and ask: \"What do you think the next call returns?\"",
  },
];

export async function reviewEngagement(ctx: ReviewContext): Promise<Observation[]> {
  if (isMock(ctx.cfg)) return mockEngagement;

  const { system, user } = observationPrompt(LOOK_FOR, ctx.timestamped);
  const raw = await completeJson<RawObservations>({ task: "engagement-review", system, user }, ctx.cfg);
  return parseObservations(raw, "engagement", ctx.segments);
}
```

- [ ] **Step 2: Commit**

```bash
git add ai-review/src/reviewers/engagement.ts
git commit -m "refactor(ai-review): engagement reviewer returns Observation[]"
```

---

## Task 10: Confidence reviewer → Observation[] (hedging only)

**Files:**
- Modify: `ai-review/src/reviewers/confidence.ts`

Fillers are no longer surfaced as coaching — they remain a client-side measured metric (`DeliveryMetricsCard`). This reviewer now flags only hedging that undercuts authority.

- [ ] **Step 1: Replace the whole file**

Replace the entire contents of `ai-review/src/reviewers/confidence.ts` with:

```ts
// Confidence: hedging that undercuts authority. Filler words are measured
// separately (client-side) and are NOT surfaced here.

import type { ReviewContext } from "../context.ts";
import type { Observation } from "../types.ts";
import { completeJson } from "../llm/client.ts";
import { isMock } from "../llm/config.ts";
import { observationPrompt, parseObservations, type RawObservations } from "./observation.ts";

const LOOK_FOR = `You flag hedging language that undercuts authority — a quoted phrase like "I think maybe", "sort of", "I guess", "probably" attached to something the teacher should state plainly.
Do NOT treat discourse markers ("okay", "so", "like") as errors — those are handled elsewhere. Only surface hedging you can quote.`;

const mockConfidence: Observation[] = [
  {
    category: "confidence",
    quote: "I think maybe the easiest way to see it is an example",
    atSec: 30,
    observation: "\"I think maybe\" hedges a claim you can state with confidence.",
    whyItMatters: "Hedged framing makes a clear idea sound uncertain to students.",
    suggestion: "State it directly: \"The easiest way to see it is an example.\"",
  },
];

export async function reviewConfidence(ctx: ReviewContext): Promise<Observation[]> {
  if (isMock(ctx.cfg)) return mockConfidence;

  const { system, user } = observationPrompt(LOOK_FOR, ctx.timestamped);
  const raw = await completeJson<RawObservations>({ task: "confidence-review", system, user }, ctx.cfg);
  return parseObservations(raw, "confidence", ctx.segments);
}
```

- [ ] **Step 2: Commit**

```bash
git add ai-review/src/reviewers/confidence.ts
git commit -m "refactor(ai-review): confidence reviewer flags only hedging"
```

---

## Task 11: Coverage reviewer → Observation[] (plan-grounded core gaps)

**Files:**
- Modify: `ai-review/src/reviewers/coverage.ts`

Coverage keeps its internal concept-checklist prompt, but only **missing/partial CORE** concepts become observations, grounded by the lesson plan (`planGrounded: true`, empty quote).

- [ ] **Step 1: Replace the whole file**

Replace the entire contents of `ai-review/src/reviewers/coverage.ts` with:

```ts
// Coverage / scope: cross-reference the transcript against the lesson plan.
// Only missing/partial CORE concepts escalate to a coaching observation — grounded
// by the plan (the one justified absence signal). Orchestrator calls this only when
// a lesson plan is present.

import type { ConceptImportance, CoverageStatus } from "@cadence/shared";
import type { ReviewContext } from "../context.ts";
import type { Observation } from "../types.ts";
import { completeJson } from "../llm/client.ts";
import { isMock } from "../llm/config.ts";
import { type Prompt, transcriptBlock } from "../llm/prompt.ts";

// ---- Prompt ---------------------------------------------------------------

function prompt(transcript: string, lessonPlan: string): Prompt {
  return {
    system: `You compare what a teacher actually said against their lesson plan.
First identify the key concepts in the lesson plan. Tag each by how lost a student would be without it:
- "core": the lesson doesn't work without it,
- "supporting": helps understanding, fine to skip if short on time,
- "optional": extras, tangents, advanced asides.
Then mark whether each concept was "covered", "partial", or "missing" in the transcript. Paraphrases count as covered.
Gaps are NOT failures — a teacher need not cover everything.

Return a single JSON object and nothing else:
{ "concepts": [ { "name": string, "importance": "core" | "supporting" | "optional", "status": "covered" | "partial" | "missing" } ] }`,
    user: `Lesson plan:\n"""\n${lessonPlan}\n"""\n\n${transcriptBlock(transcript)}`,
  };
}

// ---- Mock (LLM_PROVIDER=mock) ---------------------------------------------
// Core concepts covered → no coaching from coverage in the mock (focus comes from teaching).

const mockCoverage: Observation[] = [];

// ---- Review ---------------------------------------------------------------

interface RawConcept {
  name?: string;
  importance?: string;
  status?: string;
}
interface RawCoverage {
  concepts?: RawConcept[];
}

const IMPORTANCE: ConceptImportance[] = ["core", "supporting", "optional"];
const STATUS: CoverageStatus[] = ["covered", "partial", "missing"];
const asImportance = (s: string | undefined): ConceptImportance =>
  IMPORTANCE.includes(s as ConceptImportance) ? (s as ConceptImportance) : "supporting";
const asStatus = (s: string | undefined): CoverageStatus =>
  STATUS.includes(s as CoverageStatus) ? (s as CoverageStatus) : "missing";

export async function reviewCoverage(ctx: ReviewContext): Promise<Observation[]> {
  if (isMock(ctx.cfg)) return mockCoverage;

  const { system, user } = prompt(ctx.timestamped, ctx.lessonPlan ?? "");
  const raw = await completeJson<RawCoverage>({ task: "content-review", system, user }, ctx.cfg);

  return (raw.concepts ?? [])
    .filter((c): c is RawConcept & { name: string } => Boolean(c?.name))
    .filter((c) => asImportance(c.importance) === "core" && asStatus(c.status) !== "covered")
    .map((c): Observation => ({
      category: "coverage",
      quote: "",
      atSec: 0,
      observation: `The lesson plan lists "${c.name}" as a core idea, and it ${
        asStatus(c.status) === "partial" ? "only came up in passing" : "didn't come up"
      }.`,
      whyItMatters: "The rest of the lesson leans on this idea, so a gap here compounds.",
      suggestion: `Work "${c.name}" in early, right after your setup, before the example.`,
      planGrounded: true,
    }));
}
```

- [ ] **Step 2: Commit**

```bash
git add ai-review/src/reviewers/coverage.ts
git commit -m "refactor(ai-review): coverage surfaces only plan-grounded core gaps"
```

---

## Task 12: Coach step (replaces synthesize)

**Files:**
- Create: `ai-review/src/coach.ts`
- Delete: `ai-review/src/synthesize.ts`
- Test: `ai-review/test/coach.test.ts`

- [ ] **Step 1: Write the failing test**

Create `ai-review/test/coach.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coach, rankObservations } from "../src/coach.ts";
import { resolveConfig } from "../src/llm/config.ts";
import type { Observation } from "../src/types.ts";

const obs = (category: Observation["category"], observation: string): Observation => ({
  category,
  quote: `q-${observation}`,
  atSec: 1,
  observation,
  whyItMatters: "w",
  suggestion: "s",
});

describe("rankObservations", () => {
  it("orders coverage > teaching > structure > engagement > delivery > confidence, stable within ties", () => {
    const ranked = rankObservations([
      obs("delivery", "d"),
      obs("coverage", "c"),
      obs("teaching", "t"),
      obs("confidence", "f"),
    ]);
    assert.deepEqual(ranked.map((o) => o.category), ["coverage", "teaching", "delivery", "confidence"]);
  });
});

describe("coach (mock provider = deterministic fallback)", () => {
  const cfg = resolveConfig({ provider: "mock" });

  it("returns insufficient when there are no observations", async () => {
    const review = await coach([], cfg);
    assert.equal(review.evidenceState, "insufficient");
    assert.equal(review.focus, null);
    assert.deepEqual(review.more, []);
  });

  it("builds a focus from the top-ranked observation and caps more at 3", async () => {
    const review = await coach(
      [obs("delivery", "d"), obs("teaching", "t"), obs("structure", "s"), obs("engagement", "e"), obs("confidence", "f")],
      cfg,
    );
    assert.equal(review.evidenceState, "coached");
    assert.equal(review.focus?.category, "teaching"); // teaching outranks delivery
    assert.equal(review.focus?.quote, "q-t");
    assert.equal(review.focus?.whatHappened, "t");
    assert.equal(review.focus?.tryInstead, "s"); // suggestion seeds tryInstead in fallback
    assert.ok(review.focus?.practiceGoal.length);
    assert.equal(review.more.length, 3);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx -w ai-review tsx --test test/coach.test.ts`
Expected: FAIL — `../src/coach.ts` does not exist.

- [ ] **Step 3: Create `ai-review/src/coach.ts`**

```ts
// Reads the grounded observation pool, ranks it, and produces the coaching cards
// the client renders. One LLM pass writes the prose; every non-prose field (quote,
// atSec, category) is carried straight from the source observation, so the coach
// cannot invent evidence. Never throws: on any LLM failure it falls back to a
// deterministic card built from the top observation.

import type { CoachingCard, CoachingCategory, SessionReview } from "@cadence/shared";
import { completeJson } from "./llm/client.ts";
import { isMock, type ResolvedConfig } from "./llm/config.ts";
import type { Observation } from "./types.ts";

const MORE_CAP = 3;

/** Lower rank = higher priority. */
const RANK: Record<CoachingCategory, number> = {
  coverage: 0,
  teaching: 1,
  structure: 2,
  engagement: 3,
  delivery: 4,
  confidence: 5,
};

const DEFAULT_HEADLINE: Record<CoachingCategory, string> = {
  coverage: "Cover a key idea",
  teaching: "Sharpen a teaching move",
  structure: "Smooth the structure",
  engagement: "Lift engagement",
  delivery: "Tighten your wording",
  confidence: "Project more confidence",
};

const DEFAULT_TRY = "Run this moment again with a small, deliberate change.";
const DEFAULT_GOAL = "Re-explain this part and apply the change above.";

/** Priority order, stable within a category (keeps the reviewer's own ordering). */
export function rankObservations(observations: Observation[]): Observation[] {
  return observations
    .map((o, i) => ({ o, i }))
    .sort((a, b) => RANK[a.o.category] - RANK[b.o.category] || a.i - b.i)
    .map((x) => x.o);
}

interface RawCard {
  headline?: string;
  whatHappened?: string;
  whyItMatters?: string;
  tryInstead?: string;
  practiceGoal?: string;
}

function buildCard(o: Observation, p: RawCard | undefined): CoachingCard {
  return {
    category: o.category,
    quote: o.quote,
    atSec: o.atSec,
    headline: p?.headline?.trim() || DEFAULT_HEADLINE[o.category],
    whatHappened: p?.whatHappened?.trim() || o.observation,
    whyItMatters: p?.whyItMatters?.trim() || o.whyItMatters,
    tryInstead: p?.tryInstead?.trim() || o.suggestion || DEFAULT_TRY,
    practiceGoal: p?.practiceGoal?.trim() || DEFAULT_GOAL,
  };
}

function assemble(selected: Observation[], prose: (RawCard | undefined)[]): SessionReview {
  const cards = selected.map((o, i) => buildCard(o, prose[i]));
  return { evidenceState: "coached", focus: cards[0]!, more: cards.slice(1) };
}

function coachPrompt(selected: Observation[]): { system: string; user: string } {
  const numbered = selected
    .map(
      (o, i) =>
        `${i + 1}. [${o.category}] "${o.quote}" — ${o.observation} Why: ${o.whyItMatters}${
          o.suggestion ? ` (seed: ${o.suggestion})` : ""
        }`,
    )
    .join("\n");
  return {
    system: `You are the lead mentor. You are given a ranked list of grounded observations from a teaching-practice session; #1 is the most important.
Turn each observation into a coaching card, in the SAME order. Do not introduce any claim not present in the observations. Do not invent or alter quotes.
For each card produce:
- headline: 2–4 words naming the skill
- whatHappened: one neutral sentence
- whyItMatters: one sentence
- tryInstead: a concrete line the teacher could actually say next time
- practiceGoal: a one-sentence retry target
Return a single JSON object and nothing else: { "cards": [ { "headline", "whatHappened", "whyItMatters", "tryInstead", "practiceGoal" } ] } — one card per observation, same order.`,
    user: `Observations (ranked):\n${numbered}`,
  };
}

export async function coach(observations: Observation[], cfg: ResolvedConfig): Promise<SessionReview> {
  const selected = rankObservations(observations).slice(0, 1 + MORE_CAP);
  if (selected.length === 0) return { evidenceState: "insufficient", focus: null, more: [] };

  if (isMock(cfg)) return assemble(selected, selected.map(() => undefined));

  try {
    const { system, user } = coachPrompt(selected);
    const raw = await completeJson<{ cards?: RawCard[] }>({ task: "coach", system, user }, cfg);
    return assemble(selected, selected.map((_, i) => raw.cards?.[i]));
  } catch {
    return assemble(selected, selected.map(() => undefined));
  }
}
```

- [ ] **Step 4: Delete the old synthesizer**

Run: `git rm ai-review/src/synthesize.ts`
Expected: file removed. (Its only importer, `orchestrate.ts`, is rewritten in Task 13.)

- [ ] **Step 5: Run the coach test**

Run: `npx -w ai-review tsx --test test/coach.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ai-review/src/coach.ts
git commit -m "feat(ai-review): coach step ranks observations into cards, replaces synthesize"
```

---

## Task 13: Orchestrator — collect, validate, coach

**Files:**
- Modify: `ai-review/src/orchestrate.ts`

- [ ] **Step 1: Replace the whole file**

Replace the entire contents of `ai-review/src/orchestrate.ts` with:

```ts
// runReview: the single entry point. Builds context, runs the reviewers in
// parallel (each contained — a throw or timeout contributes no observations rather
// than blanking the report), skips coverage when there's no lesson plan, drops any
// observation whose quote isn't grounded in the transcript (mock output is trusted
// as-is), then coaches the pool into cards.

import type { SessionReview } from "@cadence/shared";
import { coach } from "./coach.ts";
import { buildContext } from "./context.ts";
import { isMock, resolveConfig } from "./llm/config.ts";
import { reviewConfidence } from "./reviewers/confidence.ts";
import { reviewCoverage } from "./reviewers/coverage.ts";
import { reviewDelivery } from "./reviewers/delivery.ts";
import { reviewEngagement } from "./reviewers/engagement.ts";
import { reviewStructure } from "./reviewers/structure.ts";
import { reviewTeaching } from "./reviewers/teaching.ts";
import { isQuoteGrounded } from "./transcript.ts";
import type { Observation, ReviewOptions, ReviewRequest } from "./types.ts";

function withTimeout<T>(p: Promise<T>, ms: number, task: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${task} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Run a reviewer; a throw or timeout contributes no observations (failure stays contained). */
async function collect(run: () => Promise<Observation[]>, timeoutMs: number): Promise<Observation[]> {
  try {
    return await withTimeout(run(), timeoutMs, "reviewer");
  } catch {
    return [];
  }
}

export async function runReview(req: ReviewRequest, opts: ReviewOptions = {}): Promise<SessionReview> {
  const cfg = resolveConfig(opts);
  const ctx = buildContext(req, cfg);
  const t = cfg.timeoutMs;

  const groups = await Promise.all([
    collect(() => reviewDelivery(ctx), t),
    ctx.lessonPlan ? collect(() => reviewCoverage(ctx), t) : Promise.resolve<Observation[]>([]),
    collect(() => reviewTeaching(ctx), t),
    collect(() => reviewStructure(ctx), t),
    collect(() => reviewEngagement(ctx), t),
    collect(() => reviewConfidence(ctx), t),
  ]);

  const all = groups.flat();
  // Mock fixtures are trusted; real LLM quotes must be grounded in the transcript.
  const grounded = isMock(cfg)
    ? all
    : all.filter((o) => o.planGrounded || isQuoteGrounded(o.quote, ctx.segments));

  return coach(grounded, cfg);
}
```

- [ ] **Step 2: Typecheck ai-review**

Run: `npx -w ai-review tsc --noEmit`
Expected: PASS (all reviewers now return `Observation[]`; `synthesize.ts` is gone).

- [ ] **Step 3: Commit**

```bash
git add ai-review/src/orchestrate.ts
git commit -m "feat(ai-review): orchestrator collects, grounds, and coaches observations"
```

---

## Task 14: Update ai-review integration tests

**Files:**
- Modify: `ai-review/test/orchestrate.test.ts`

- [ ] **Step 1: Replace the runReview suites**

Replace the entire contents of `ai-review/test/orchestrate.test.ts` with:

```ts
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { WordTiming } from "@cadence/shared";
import { extractConcepts, runReview } from "../src/index.ts";

const words: WordTiming[] = "So, um, recursion is when a function calls itself.".split(" ").map((text, i) => ({
  text,
  start: i * 0.4,
  end: i * 0.4 + 0.35,
}));

const savedKey = process.env.OPENAI_API_KEY;
afterEach(() => {
  if (savedKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = savedKey;
});

describe("runReview (mock provider)", () => {
  it("returns a grounded focus card", async () => {
    const review = await runReview({ words, lessonPlan: "Recursion" }, { provider: "mock" });
    assert.equal(review.evidenceState, "coached");
    assert.ok(review.focus, "expected a focus card");
    assert.ok(review.focus!.headline.length);
    assert.ok(review.focus!.tryInstead.length);
    assert.ok(review.focus!.practiceGoal.length);
    assert.ok(Array.isArray(review.more));
  });

  it("still coaches without a lesson plan (coverage contributes nothing)", async () => {
    const review = await runReview({ words }, { provider: "mock" });
    assert.equal(review.evidenceState, "coached");
    assert.notEqual(review.focus, null);
    // No coverage observation can appear without a plan.
    assert.equal([review.focus, ...review.more].some((c) => c && c.category === "coverage"), false);
  });
});

describe("runReview failure containment", () => {
  it("returns insufficient (not an error) when every reviewer fails", async () => {
    // The openai provider without a key makes every LLM call throw → no observations.
    delete process.env.OPENAI_API_KEY;
    const review = await runReview({ words, lessonPlan: "Recursion" }, { provider: "openai" });
    assert.equal(review.evidenceState, "insufficient");
    assert.equal(review.focus, null);
    assert.deepEqual(review.more, []);
  });
});

describe("extractConcepts (mock provider)", () => {
  it("returns concepts with a 1-5 importance", async () => {
    const concepts = await extractConcepts([{ name: "a.md", text: "x" }], { provider: "mock" });
    assert.ok(concepts.length > 0);
    for (const c of concepts) assert.ok(c.importance === undefined || (c.importance >= 1 && c.importance <= 5));
  });
});
```

- [ ] **Step 2: Run the whole ai-review suite**

Run: `npm -w ai-review test`
Expected: PASS — `observation.test.ts`, `coach.test.ts`, `orchestrate.test.ts`, `concepts.test.ts` all green.

- [ ] **Step 3: Commit**

```bash
git add ai-review/test/orchestrate.test.ts
git commit -m "test(ai-review): assert coaching-card output shape"
```

---

## Task 15: Update the demo script

**Files:**
- Modify: `ai-review/demo/run.ts`

- [ ] **Step 1: Replace the whole file**

Replace the entire contents of `ai-review/demo/run.ts` with:

```ts
// CLI demo: run the review on a transcript JSON (+ optional lesson plan) and
// pretty-print the coaching cards.
//
//   npm run demo -- demo/sample-transcript.json demo/sample-lesson-plan.md
//   npm run demo -- demo/sample-transcript.json          (coverage skipped)
//
// LLM_PROVIDER=mock (default) runs offline. Set LLM_PROVIDER=openai + OPENAI_API_KEY
// in .env to use the real model.

import { readFileSync } from "node:fs";
import type { CoachingCard, WordTiming } from "@cadence/shared";
import { runReview } from "../src/index.ts";
import { mmss } from "../src/transcript.ts";

const [transcriptPath, lessonPlanPath] = process.argv.slice(2);

if (!transcriptPath) {
  console.error("Usage: npm run demo -- <transcript.json> [lessonPlan.(md|txt)]");
  process.exit(1);
}

const words = JSON.parse(readFileSync(transcriptPath, "utf8")) as WordTiming[];
const lessonPlan = lessonPlanPath ? readFileSync(lessonPlanPath, "utf8") : undefined;

const H = (s: string) => `\n\x1b[1m${s}\x1b[0m`;
const at = (sec: number) => `\x1b[2m[${mmss(sec)}]\x1b[0m`;
const quote = (q: string) => `\x1b[2m"${q}"\x1b[0m`;

function card(c: CoachingCard): void {
  console.log(`  \x1b[1m${c.headline}\x1b[0m  \x1b[2m(${c.category})\x1b[0m`);
  if (c.quote) console.log(`    ${at(c.atSec)} ${quote(c.quote)}`);
  console.log(`    What: ${c.whatHappened}`);
  console.log(`    Why:  ${c.whyItMatters}`);
  console.log(`    Try:  ${c.tryInstead}`);
  console.log(`    Goal: ${c.practiceGoal}`);
}

const review = await runReview({ words, lessonPlan });

console.log(H("═══ CADENCE — SESSION REVIEW ═══"));

if (review.evidenceState === "insufficient" || !review.focus) {
  console.log("\n  Not enough to evaluate yet — record a longer segment.\n");
} else {
  console.log(H("➤ Focus"));
  card(review.focus);
  if (review.more.length) {
    console.log(H("More"));
    for (const c of review.more) card(c);
  }
  console.log("");
}
```

- [ ] **Step 2: Run the demo offline**

Run: `npm -w ai-review run demo -- demo/sample-transcript.json demo/sample-lesson-plan.md`
Expected: prints a Focus card (headline, quote, What/Why/Try/Goal) and a few More cards; no crash.

- [ ] **Step 3: Commit**

```bash
git add ai-review/demo/run.ts
git commit -m "chore(ai-review): demo prints coaching cards"
```

---

## Task 16: Client types cleanup

**Files:**
- Modify: `client/src/types.ts`

- [ ] **Step 1: Replace the whole file**

Replace the entire contents of `client/src/types.ts` with:

```ts
// Client-only types. What crosses the wire lives in `@cadence/shared`; this file
// holds what the UI adds on top of it (concept origin, the session handed from
// Practice to Review).

import type { Concept as WireConcept, DeliveryMetrics, SourceFile, WordTiming } from "@cadence/shared";

// ---- Materials -------------------------------------------------------------

export type ConceptOrigin = "extracted" | "user";

/** A wire concept plus where the UI got it from. `origin` never goes over the wire. */
export interface Concept extends WireConcept {
  origin: ConceptOrigin;
}

export interface LectureMaterial {
  files: SourceFile[];
  concepts: Concept[];
}

// ---- Practice → Review -----------------------------------------------------

/** What Practice hands to Review on Finish. */
export interface CompletedSession {
  /** Word-level timings from live transcription: what the review is built from. */
  words: WordTiming[];
  durationSec: number;
  /** Full committed transcript text. */
  transcript: string;
  /** Measured delivery metrics (WPM, pauses, fillers, pitch, volume). */
  metrics: DeliveryMetrics;
  /** Browser-local recording for playback on Review; never uploaded. */
  recording: Blob;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/types.ts
git commit -m "refactor(client): drop the review view-model types"
```

---

## Task 17: Simplify useReview

**Files:**
- Modify: `client/src/hooks/useReview.ts`

- [ ] **Step 1: Replace the whole file**

Replace the entire contents of `client/src/hooks/useReview.ts` with:

```ts
import { useCallback, useEffect, useState } from "react";
import type { SessionReview } from "@cadence/shared";
import { api } from "../api";
import type { CompletedSession, LectureMaterial } from "../types";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; review: SessionReview };

/** Requests the review once on mount (and again on `retry`), ignoring results after unmount. */
export function useReview(material: LectureMaterial, session: CompletedSession) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    api.review.requestReview(material, session, controller.signal).then(
      (review) => {
        if (!controller.signal.aborted) setState({ status: "ready", review });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: "error" });
      },
    );
    return () => controller.abort();
    // The session is fixed for this screen's lifetime; only Retry re-runs the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, retry };
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/useReview.ts
git commit -m "refactor(client): useReview returns the raw SessionReview"
```

---

## Task 18: CoachingCardView component (+ delete dead components)

**Files:**
- Create: `client/src/components/CoachingCardView.tsx`
- Delete: `client/src/components/SectionCard.tsx`, `client/src/components/FactualIssues.tsx`
- Test: `client/test/labels.test.ts`

- [ ] **Step 1: Create the component**

Create `client/src/components/CoachingCardView.tsx`:

```tsx
import { useState } from "react";
import type { CoachingCard, CoachingCategory } from "@cadence/shared";

/** Category → display label. Coverage shows as "Content" in the UI. */
export const categoryLabel: Record<CoachingCategory, string> = {
  delivery: "Delivery",
  coverage: "Content",
  teaching: "Teaching",
  structure: "Structure",
  engagement: "Engagement",
  confidence: "Confidence",
};

function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

interface Props {
  card: CoachingCard;
  /** `more` cards render collapsed behind a summary; the focus card is always open. */
  collapsible?: boolean;
}

const card = "rounded-2xl bg-white p-5 ring-1 ring-slate-200";

function Body({ data }: { data: CoachingCard }) {
  return (
    <div className="mt-3 space-y-3 text-sm">
      {data.quote && (
        <blockquote className="border-l-2 border-brand-100 pl-3 text-slate-500 italic">
          {`“${data.quote}”`}
          {data.atSec > 0 && <span className="ml-2 not-italic text-slate-400">[{mmss(data.atSec)}]</span>}
        </blockquote>
      )}
      <p className="text-slate-700">{data.whatHappened}</p>
      <p className="text-slate-500">{data.whyItMatters}</p>
      <div className="rounded-xl bg-brand-50 px-4 py-3">
        <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Try instead</p>
        <p className="mt-1 text-slate-800">{data.tryInstead}</p>
      </div>
      <p className="text-slate-600">
        <span className="font-semibold text-slate-700">Practice goal: </span>
        {data.practiceGoal}
      </p>
    </div>
  );
}

export default function CoachingCardView({ card: data, collapsible = false }: Props) {
  const [open, setOpen] = useState(false);
  const label = (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      {categoryLabel[data.category]}
    </span>
  );

  if (!collapsible) {
    return (
      <section className={`${card} ring-2 ring-brand-600/40`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-brand-700">{data.headline}</h2>
          {label}
        </div>
        <Body data={data} />
      </section>
    );
  }

  return (
    <section className={card}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="font-semibold text-slate-800">{data.headline}</span>
        <span className="flex items-center gap-2">
          {label}
          <span className="text-slate-400" aria-hidden>
            {open ? "▾" : "▸"}
          </span>
        </span>
      </button>
      {open && <Body data={data} />}
    </section>
  );
}
```

- [ ] **Step 2: Delete the dead components**

Run:
```bash
git rm client/src/components/SectionCard.tsx client/src/components/FactualIssues.tsx
```
Expected: both removed. (Their importer, `ReviewScreen.tsx`, is rewritten in Task 19.)

- [ ] **Step 3: Write the label test (keeps the client test glob non-empty)**

Create `client/test/labels.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categoryLabel } from "../src/components/CoachingCardView.tsx";

describe("categoryLabel", () => {
  it("labels coverage as Content and covers every category", () => {
    assert.equal(categoryLabel.coverage, "Content");
    assert.deepEqual(
      Object.keys(categoryLabel).sort(),
      ["confidence", "coverage", "delivery", "engagement", "structure", "teaching"],
    );
  });
});
```

- [ ] **Step 4: Delete the old view-model test**

Run: `git rm client/test/reviewView.test.ts`
Expected: removed (the `reviewView` module it tests is deleted in Task 21).

- [ ] **Step 5: Run the client test**

Run: `npm -w client test`
Expected: PASS — `labels.test.ts` runs; the glob is non-empty.

> Note: `tsx` imports the `.tsx` component fine, but if importing JSX into the test runner errors in this environment, move `categoryLabel` and `mmss` into a new `client/src/lib/cardLabels.ts`, import it from both `CoachingCardView.tsx` and the test, and re-run. Prefer the single-file version first.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/CoachingCardView.tsx client/test/labels.test.ts
git commit -m "feat(client): CoachingCardView; remove SectionCard/FactualIssues"
```

---

## Task 19: Rewrite the Review screen

**Files:**
- Modify: `client/src/screens/ReviewScreen.tsx`

- [ ] **Step 1: Replace the whole file**

Replace the entire contents of `client/src/screens/ReviewScreen.tsx` with:

```tsx
import { useEffect, useState } from "react";
import CoachingCardView from "../components/CoachingCardView";
import DeliveryMetricsCard from "../components/DeliveryMetricsCard";
import DevModal from "../components/DevModal";
import { useReview } from "../hooks/useReview";
import type { CompletedSession, LectureMaterial } from "../types";

interface Props {
  material: LectureMaterial;
  session: CompletedSession;
  /** Carries the focus card's practice goal into the next session. */
  onPracticeAgain: (practiceGoal?: string) => void;
}

const primaryButton =
  "rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

export default function ReviewScreen({ material, session, onPracticeAgain }: Props) {
  const state = useReview(material, session);
  const [devOpen, setDevOpen] = useState(false);

  // Dev tool: "d" toggles an inspector for the raw server response; Esc closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        setDevOpen((open) => !open);
      } else if (e.key === "Escape") {
        setDevOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const devModal = devOpen && (
    <DevModal
      status={state.status}
      raw={state.status === "ready" ? state.review : undefined}
      material={material}
      session={session}
      onClose={() => setDevOpen(false)}
    />
  );

  if (state.status === "loading") {
    return (
      <>
        {devModal}
        <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-8">
          <div role="status" className="text-center">
            <div
              className="mx-auto size-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600"
              aria-hidden
            />
            <p className="mt-4 text-lg font-medium">Reviewing your session…</p>
          </div>
        </main>
      </>
    );
  }

  if (state.status === "error") {
    return (
      <>
        {devModal}
        <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
          <div className="w-full rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 sm:p-8">
            <h1 className="text-xl font-semibold">We couldn't review your session</h1>
            <p role="alert" className="mt-1 text-sm text-slate-600">
              Something went wrong on our end. Your materials are still saved.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={state.retry} className={primaryButton}>
                Retry
              </button>
              <button
                type="button"
                onClick={() => onPracticeAgain()}
                className="rounded-xl px-6 py-3 text-base font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Back to setup
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  const { review } = state;
  const coached = review.evidenceState === "coached" && review.focus;

  return (
    <>
      {devModal}
      <main className="mx-auto min-h-screen max-w-xl space-y-6 px-4 py-8">
        <DeliveryMetricsCard session={session} />

        {coached ? (
          <div className="space-y-3">
            <CoachingCardView card={review.focus!} />
            {review.more.map((c, i) => (
              <CoachingCardView key={i} card={c} collapsible />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-white p-5 text-sm text-slate-600 ring-1 ring-slate-200">
            Not enough to evaluate yet — record a longer segment and try again.
          </p>
        )}

        <button
          type="button"
          onClick={() => onPracticeAgain(review.focus?.practiceGoal)}
          className={`${primaryButton} w-full`}
        >
          Practice again
        </button>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/screens/ReviewScreen.tsx
git commit -m "feat(client): review screen renders coaching cards, no chrome"
```

---

## Task 20: Practice-goal handoff (App + PracticeScreen)

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/screens/PracticeScreen.tsx`

- [ ] **Step 1: Thread the goal through App**

Replace the entire contents of `client/src/App.tsx` with:

```tsx
import { useState } from "react";
import { useMaterialSetup } from "./hooks/useMaterialSetup";
import PracticeScreen from "./screens/PracticeScreen";
import ReviewScreen from "./screens/ReviewScreen";
import SetupScreen from "./screens/SetupScreen";
import type { CompletedSession } from "./types";

type View =
  | { name: "setup" }
  | { name: "practice"; stream: MediaStream }
  | { name: "review"; session: CompletedSession };

export default function App() {
  const [view, setView] = useState<View>({ name: "setup" });
  // Held here (not in SetupScreen) so the material survives Setup → Practice → Setup.
  const setup = useMaterialSetup();
  // Carried from a review's focus card into the next practice session as a reminder.
  const [practiceGoal, setPracticeGoal] = useState<string | undefined>(undefined);

  if (view.name === "practice") {
    return (
      <PracticeScreen
        material={setup.material}
        stream={view.stream}
        practiceGoal={practiceGoal}
        onFinish={(session) => setView({ name: "review", session })}
        onCancel={() => setView({ name: "setup" })}
      />
    );
  }
  if (view.name === "review") {
    // The review is discarded on the way back; material stays in `setup`.
    return (
      <ReviewScreen
        material={setup.material}
        session={view.session}
        onPracticeAgain={(goal) => {
          setPracticeGoal(goal);
          setView({ name: "setup" });
        }}
      />
    );
  }
  return <SetupScreen setup={setup} onStart={(stream) => setView({ name: "practice", stream })} />;
}
```

- [ ] **Step 2: Add the reminder banner to PracticeScreen**

In `client/src/screens/PracticeScreen.tsx`, add `practiceGoal` to the `Props` interface. Change:

```tsx
interface Props {
  material: LectureMaterial;
  /** Already-open mic stream from Setup. Reuse it; don't call getUserMedia again. */
  stream: MediaStream;
  onFinish: (session: CompletedSession) => void;
  /** Leave practice without a session (e.g. capture couldn't start). */
  onCancel: () => void;
}
```

to:

```tsx
interface Props {
  material: LectureMaterial;
  /** Already-open mic stream from Setup. Reuse it; don't call getUserMedia again. */
  stream: MediaStream;
  /** Carried from the last review's focus card; shown as a reminder banner. */
  practiceGoal?: string;
  onFinish: (session: CompletedSession) => void;
  /** Leave practice without a session (e.g. capture couldn't start). */
  onCancel: () => void;
}
```

- [ ] **Step 3: Destructure and render the banner**

In the same file, change the component signature line:

```tsx
export default function PracticeScreen({ material, stream, onFinish, onCancel }: Props) {
```

to:

```tsx
export default function PracticeScreen({ material, stream, practiceGoal, onFinish, onCancel }: Props) {
```

Then, immediately after the `</header>` closing tag in the main (recording) return block and before the `{error && (` block, insert:

```tsx
      {practiceGoal && (
        <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-slate-800">
          <span className="font-semibold text-brand-700">This time: </span>
          {practiceGoal}
        </p>
      )}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx client/src/screens/PracticeScreen.tsx
git commit -m "feat(client): carry focus practice goal into the next session"
```

---

## Task 21: Delete the old mapper and verify the whole build

**Files:**
- Delete: `client/src/lib/reviewView.ts`

- [ ] **Step 1: Delete the mapper**

Run: `git rm client/src/lib/reviewView.ts`
Expected: removed. (Its importers — `useReview.ts`, `ReviewScreen.tsx`, and the old test — are all already updated/deleted.)

- [ ] **Step 2: Confirm nothing still imports removed modules**

Run: `grep -rn "reviewView\|SectionCard\|FactualIssues\|toReviewView\|topPriority\|\.summary\b" client/src`
Expected: no matches (empty output).

- [ ] **Step 3: Typecheck every workspace**

Run: `npm run typecheck`
Expected: PASS for shared, ai-review, client, server.

- [ ] **Step 4: Run every workspace's tests**

Run: `npm test`
Expected: PASS (ai-review suites + client `labels.test.ts`).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: PASS (client `tsc -b && vite build`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(client): remove reviewView mapper; green typecheck/test/build"
```

---

## Task 22: Manual end-to-end check (offline mock)

**Files:** none (verification only)

- [ ] **Step 1: Start the app**

Run: `npm run dev`
Then open the client URL Vite prints.

- [ ] **Step 2: Walk the loop**

- Set up a session (upload/add a concept), start practice, speak a few sentences, Finish.
- On Review: confirm there is **no** summary/heading prose — the page shows the metrics card, then one prominent **Focus** card, then collapsed "more" cards you can expand, then "Practice again".
- Press `d` to open the dev inspector and confirm the server response is `{ evidenceState, focus, more }`.
- Click "Practice again" and confirm the focus card's practice goal appears as a "This time:" banner on the next practice screen.

- [ ] **Step 3: Thin-sample check**

- Start practice, say one or two words, Finish immediately.
- With the real model (`LLM_PROVIDER=openai`), confirm Review shows "Not enough to evaluate yet". (On the default mock provider it will still show canned cards — that's expected, since mock fixtures bypass the grounding gate.)

- [ ] **Step 4: Stop the dev server**

Press Ctrl-C in the `npm run dev` terminal.

---

## Notes / deferred (out of scope, per spec)

- **#6 Metric sanity layer** and **#7 filler reclassification** are deferred. `DeliveryMetricsCard`, `shared/src/speaking.ts` `FILLER_PHRASES`, and `ai-review/src/context.ts` `fillersPerMinute` are intentionally left unchanged.
- **Seeking audio to `atSec`**: no audio player exists on the Review screen today, so cards render the timestamp as a `[m:ss]` label only. Wiring playback is a future task.
- `server/src/routes/review.ts` is a passthrough of `SessionReview` and needs no change; Task 21's `npm run typecheck` covers the server.
