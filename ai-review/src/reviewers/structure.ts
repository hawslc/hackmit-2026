// Clarity & structure: lesson-level organization (macro), distinct from delivery.

import type { StructureIssue, StructureReview } from "@ta-coach/shared";
import type { ReviewContext } from "../context.ts";
import { completeJson } from "../llm/client.ts";
import { isMock } from "../llm/config.ts";
import { type Prompt, SHARED_RULES, transcriptBlock } from "../llm/prompt.ts";
import { locateQuoteSec } from "../transcript.ts";

// ---- Prompt ---------------------------------------------------------------

function prompt(transcript: string): Prompt {
  return {
    system: `You judge the LESSON-LEVEL structure, not sentence phrasing.
Look at: a clear opening that frames what's coming, logical ordering of ideas, smooth transitions between topics, and a recap/close. Flag confusing jumps, missing setup, or an abrupt ending.

Return JSON: {
  "note": string,                       // one sentence on overall structure
  "issues": [
    { "problem": string,                // e.g. "jumps into recursion before defining a base case"
      "suggestion": string,
      "quote": string }                 // transcript quote near the issue ("" if none applies)
  ]
}
If the structure is sound, return an empty "issues" array and a positive note.
${SHARED_RULES}`,
    user: transcriptBlock(transcript),
  };
}

// ---- Mock (LLM_PROVIDER=mock) ---------------------------------------------

const mockStructure: StructureReview = {
  note: "Good arc overall: definition, example, then a close — one transition was abrupt.",
  issues: [
    {
      problem: "Jumps from the definition straight into factorial without saying why we start there.",
      suggestion: "Add a one-line bridge: \"Let's see this with the simplest example — factorial.\"",
      quote: "okay so let's compute factorial of 3",
      atSec: 58,
    },
  ],
};

// ---- Review ---------------------------------------------------------------

interface RawIssue {
  problem?: string;
  suggestion?: string;
  quote?: string;
}
interface RawStructure {
  note?: string;
  issues?: RawIssue[];
}

export async function reviewStructure(ctx: ReviewContext): Promise<StructureReview> {
  if (isMock(ctx.cfg)) return mockStructure;

  const { system, user } = prompt(ctx.timestamped);
  const raw = await completeJson<RawStructure>({ task: "structure-review", system, user }, ctx.cfg);

  const issues: StructureIssue[] = (raw.issues ?? [])
    .filter((i): i is RawIssue & { problem: string } => Boolean(i?.problem))
    .map((i) => {
      const issue: StructureIssue = {
        problem: i.problem,
        suggestion: i.suggestion ?? "",
      };
      if (i.quote) {
        issue.quote = i.quote;
        issue.atSec = locateQuoteSec(i.quote, ctx.segments);
      }
      return issue;
    });

  return { note: raw.note ?? "", issues };
}
