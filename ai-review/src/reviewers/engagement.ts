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
