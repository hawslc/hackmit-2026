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
