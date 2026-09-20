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
