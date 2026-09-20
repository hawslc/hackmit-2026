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
