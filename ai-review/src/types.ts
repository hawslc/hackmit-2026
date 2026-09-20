// Contracts local to the ai-review module. Everything that crosses the package
// boundary (the request words, the SessionReview it returns, concepts) lives in
// `@ta-coach/shared`.

import type { WordTiming } from "@ta-coach/shared";

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
