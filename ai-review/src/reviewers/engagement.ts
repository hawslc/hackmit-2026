// Engagement: interactivity, questions, energy — the human-connection angle.

import type { ReviewContext } from "../context.ts";
import { isMock } from "../env.ts";
import { completeJson } from "../llm.ts";
import { mockEngagement } from "../mock.ts";
import { engagementPrompt } from "../prompts.ts";
import { locateQuoteSec } from "../transcript.ts";
import type { EngagementObservation, EngagementReview } from "../types.ts";

interface RawObservation {
  quote?: string;
  note?: string;
}
interface RawEngagement {
  note?: string;
  observations?: RawObservation[];
}

export async function reviewEngagement(ctx: ReviewContext): Promise<EngagementReview> {
  if (isMock(ctx.cfg)) return mockEngagement;

  const { system, user } = engagementPrompt(ctx.timestamped);
  const raw = await completeJson<RawEngagement>({ task: "engagement-review", system, user }, ctx.cfg);

  const observations: EngagementObservation[] = (raw.observations ?? [])
    .filter((o): o is RawObservation & { quote: string } => Boolean(o?.quote))
    .map((o) => ({
      quote: o.quote,
      atSec: locateQuoteSec(o.quote, ctx.segments),
      note: o.note ?? "",
    }));

  return { note: raw.note ?? "", observations };
}
