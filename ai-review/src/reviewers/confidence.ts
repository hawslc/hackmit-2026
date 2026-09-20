// Confidence & filler: hedging + filler words. fillersPerMinute is deterministic
// (from timestamps); the LLM only picks illustrative instances and writes the note.

import type { ConfidenceInstance, ConfidenceInstanceType, ConfidenceReview } from "@cadence/shared";
import type { ReviewContext } from "../context.ts";
import { completeJson } from "../llm/client.ts";
import { isMock } from "../llm/config.ts";
import { type Prompt, SHARED_RULES, transcriptBlock } from "../llm/prompt.ts";
import { locateQuoteSec } from "../transcript.ts";

// ---- Prompt ---------------------------------------------------------------

function prompt(transcript: string, fillersPerMinute: number): Prompt {
  return {
    system: `You flag language that undercuts authority: hedging/uncertainty ("I think maybe", "sort of", "I guess", "probably") and filler words ("um", "uh", "like", "so", "basically", "you know").
Treat the provided fillers-per-minute figure as ground truth; do not recompute it.

Return JSON: {
  "note": string,                       // one encouraging sentence; reference the fillers/min figure if relevant
  "instances": [
    { "quote": string,                  // verbatim from the transcript
      "type": "hedge" | "filler" }
  ]
}
List the clearest handful of instances, not every one.
${SHARED_RULES}`,
    user: `Measured fillers per minute (ground truth): ${fillersPerMinute}\n\n${transcriptBlock(transcript)}`,
  };
}

// ---- Mock (LLM_PROVIDER=mock) ---------------------------------------------

const mockConfidence: ConfidenceReview = {
  note: "Confident overall; a few hedges and fillers early on that are easy to trim.",
  fillersPerMinute: 4.2,
  instances: [
    { quote: "recursion is basically when a function, like, calls itself", atSec: 12, type: "filler" },
    { quote: "I think maybe the easiest way to see it is an example", atSec: 30, type: "hedge" },
    { quote: "so, um, the base case", atSec: 41, type: "filler" },
  ],
};

// ---- Review ---------------------------------------------------------------

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

  const { system, user } = prompt(ctx.timestamped, ctx.fillersPerMinute);
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
