// Everything a reviewer needs, computed once per request. Built by the
// orchestrator and passed to each reviewer.

import type { WordTiming } from "@ta-coach/shared";
import type { ResolvedConfig } from "./llm/config.ts";
import type { ReviewRequest } from "./types.ts";
import {
  type Segment,
  fillersPerMinute,
  formatTimestampedTranscript,
  splitSentences,
} from "./transcript.ts";

export interface ReviewContext {
  cfg: ResolvedConfig;
  words: WordTiming[];
  segments: Segment[];
  /** "[mm:ss] sentence" lines handed to the LLM. */
  timestamped: string;
  lessonPlan?: string;
  /** Deterministic ground-truth for the confidence reviewer. */
  fillersPerMinute: number;
}

export function buildContext(req: ReviewRequest, cfg: ResolvedConfig): ReviewContext {
  const words = req.words;
  return {
    cfg,
    words,
    segments: splitSentences(words),
    timestamped: formatTimestampedTranscript(words),
    lessonPlan: req.lessonPlan,
    fillersPerMinute: fillersPerMinute(words),
  };
}
