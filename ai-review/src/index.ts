// Public entry point. A backend imports { runReview } and calls it in a route;
// the CLI demo imports the same function. The request/response contracts
// (SessionReview, Concept, …) live in `@ta-coach/shared`.

export { runReview } from "./orchestrate.ts";
export { extractConcepts } from "./concepts.ts";
export type { LlmProvider, ReviewOptions, ReviewRequest } from "./types.ts";
export { LlmError } from "./llm/client.ts";
export type { LlmErrorKind } from "./llm/client.ts";
