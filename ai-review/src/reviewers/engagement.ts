// Engagement: interactivity, questions, energy — the human-connection angle.

import type { EngagementObservation, EngagementReview } from "@ta-coach/shared";
import type { ReviewContext } from "../context.ts";
import { completeJson } from "../llm/client.ts";
import { isMock } from "../llm/config.ts";
import { type Prompt, SHARED_RULES, transcriptBlock } from "../llm/prompt.ts";
import { locateQuoteSec } from "../transcript.ts";

// ---- Prompt ---------------------------------------------------------------

function prompt(transcript: string): Prompt {
  return {
    system: `You judge how engaging and interactive the teaching is — the human-connection dimension.
Look for: questions posed to students, invitations to participate, relatable framing, energy and warmth. Also note flat or one-directional stretches where students are only talked at.

Return JSON: {
  "note": string,                       // one sentence on overall engagement
  "observations": [
    { "quote": string,                  // verbatim from the transcript
      "note": string }                  // what this moment shows (e.g. "open question invites thinking", "long flat stretch")
  ]
}
${SHARED_RULES}`,
    user: transcriptBlock(transcript),
  };
}

// ---- Mock (LLM_PROVIDER=mock) ---------------------------------------------

const mockEngagement: EngagementReview = {
  note: "Warm and approachable; mostly one-directional, with one nice invitation to think.",
  observations: [
    {
      quote: "what do you think happens if the function never reaches the base case?",
      atSec: 96,
      note: "Open question that invites prediction — great engagement moment.",
    },
    {
      quote: "so we just keep going and going and going through each number",
      atSec: 70,
      note: "A longer flat stretch — a quick call-and-response here would lift energy.",
    },
  ],
};

// ---- Review ---------------------------------------------------------------

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

  const { system, user } = prompt(ctx.timestamped);
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
