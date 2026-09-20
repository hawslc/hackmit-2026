// Contracts local to the ai-review module. Everything that crosses the package
// boundary (the request words, the SessionReview it returns, concepts) lives in
// `@cadence/shared`.

import type { CoachingCategory, WordTiming } from "@cadence/shared";

export type LlmProvider = "mock" | "openai";

/** Input to `runReview`. */
export interface ReviewRequest {
  words: WordTiming[];
  /** Raw lesson-plan / materials text. When absent, the coverage section is skipped. */
  lessonPlan?: string;
}

/** Per-request overrides; fall back to env. Lets a backend control model/timeout per call. */
export interface ReviewOptions {
  provider?: LlmProvider;
  model?: string;
  /** Per-reviewer timeout in ms (default 30000). */
  timeoutMs?: number;
}

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
