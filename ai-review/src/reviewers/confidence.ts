// Confidence & filler: hedging + filler words. fillersPerMinute is deterministic
// (from timestamps); the LLM only picks illustrative instances and writes the note.

import type { ReviewContext } from "../context.ts";
import { isMock } from "../env.ts";
import { completeJson } from "../llm.ts";
import { mockConfidence } from "../mock.ts";
import { confidencePrompt } from "../prompts.ts";
import { locateQuoteSec } from "../transcript.ts";
import type { ConfidenceInstance, ConfidenceInstanceType, ConfidenceReview } from "../types.ts";

interface RawInstance {
  quote?: string;
  type?: string;
}
interface RawConfidence {
  note?: string;
  instances?: RawInstance[];
}

const asType = (s: string | undefined): ConfidenceInstanceType => (s === "hedge" ? "hedge" : "filler");

export async function reviewConfidence(ctx: ReviewContext): Promise<ConfidenceReview> {
  if (isMock(ctx.cfg)) return mockConfidence;

  const { system, user } = confidencePrompt(ctx.timestamped, ctx.fillersPerMinute);
  const raw = await completeJson<RawConfidence>({ task: "confidence-review", system, user }, ctx.cfg);

  const instances: ConfidenceInstance[] = (raw.instances ?? [])
    .filter((i): i is RawInstance & { quote: string } => Boolean(i?.quote))
    .map((i) => ({
      quote: i.quote,
      atSec: locateQuoteSec(i.quote, ctx.segments),
      type: asType(i.type),
    }));

  // fillersPerMinute is measured, not LLM-judged.
  return { note: raw.note ?? "", fillersPerMinute: ctx.fillersPerMinute, instances };
}
