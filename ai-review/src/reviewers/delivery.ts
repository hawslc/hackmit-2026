// Delivery: word-level clarity & conciseness only (no fillers/tone/pace).

import type { ReviewContext } from "../context.ts";
import { isMock } from "../env.ts";
import { completeJson } from "../llm.ts";
import { mockDelivery } from "../mock.ts";
import { deliveryPrompt } from "../prompts.ts";
import { locateQuoteSec } from "../transcript.ts";
import type { DeliveryIssue, DeliveryMoment, DeliveryReview } from "../types.ts";

interface RawMoment {
  quote?: string;
  issue?: string;
  suggestion?: string;
}
interface RawDelivery {
  note?: string;
  moments?: RawMoment[];
}

const ISSUES: DeliveryIssue[] = ["rambling", "verbose", "unclear"];
const asIssue = (s: string | undefined): DeliveryIssue =>
  ISSUES.includes(s as DeliveryIssue) ? (s as DeliveryIssue) : "unclear";

export async function reviewDelivery(ctx: ReviewContext): Promise<DeliveryReview> {
  if (isMock(ctx.cfg)) return mockDelivery;

  const { system, user } = deliveryPrompt(ctx.timestamped);
  const raw = await completeJson<RawDelivery>({ task: "delivery-review", system, user }, ctx.cfg);

  const moments: DeliveryMoment[] = (raw.moments ?? [])
    .filter((m): m is RawMoment & { quote: string } => Boolean(m?.quote))
    .map((m) => ({
      quote: m.quote,
      atSec: locateQuoteSec(m.quote, ctx.segments),
      issue: asIssue(m.issue),
      suggestion: m.suggestion ?? "",
    }));

  return { note: raw.note ?? "", moments };
}
