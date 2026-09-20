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
