// Delivery: word-level clarity & conciseness only (no fillers/tone/pace).

import type { DeliveryIssue, DeliveryMoment, DeliveryReview } from "@cadence/shared";
import type { ReviewContext } from "../context.ts";
import { completeJson } from "../llm/client.ts";
import { isMock } from "../llm/config.ts";
import { type Prompt, SHARED_RULES, transcriptBlock } from "../llm/prompt.ts";
import { locateQuoteSec } from "../transcript.ts";

// ---- Prompt ---------------------------------------------------------------

function prompt(transcript: string): Prompt {
  return {
    system: `You are a delivery coach judging ONLY the clarity and conciseness of a teacher's wording.
Judge from the words themselves. Do NOT comment on filler words, tone, volume, pace, or confidence — other reviewers handle those.
Flag specific moments where the speaker:
- rambles (a long run-on that loses the point),
- is verbose (says in many words what could be said in few, or repeats themselves),
- is unclear (a sentence a student would struggle to parse).
If the wording is already clear and concise, say so and return an empty "moments" array.

Return JSON: {
  "note": string,                       // one encouraging sentence on overall clarity & conciseness
  "moments": [
    { "quote": string,                  // verbatim from the transcript
      "issue": "rambling" | "verbose" | "unclear",
      "suggestion": string }            // a tighter/clearer way to say it
  ]
}
${SHARED_RULES}`,
    user: transcriptBlock(transcript),
  };
}

// ---- Mock (LLM_PROVIDER=mock) ---------------------------------------------

const mockDelivery: DeliveryReview = {
  note: "Mostly clear and to the point — a couple of spots run long and could be tightened.",
  moments: [
    {
      quote:
        "So recursion is basically when a function, like, calls itself, and it keeps calling itself over and over until, you know, eventually it stops at some point",
      atSec: 12,
      issue: "rambling",
      suggestion: "Tighten to: \"Recursion is when a function calls itself until it hits a stopping condition.\"",
    },
    {
      quote: "the base case is the case that is the base, the one that doesn't recurse",
      atSec: 41,
      issue: "verbose",
      suggestion: "Say it once: \"The base case is the stopping condition — it doesn't call the function again.\"",
    },
  ],
};

// ---- Review ---------------------------------------------------------------

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

  const { system, user } = prompt(ctx.timestamped);
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
