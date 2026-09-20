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
