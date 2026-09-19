// Clarity & structure: lesson-level organization (macro), distinct from delivery.

import type { ReviewContext } from "../context.ts";
import { isMock } from "../env.ts";
import { completeJson } from "../llm.ts";
import { mockStructure } from "../mock.ts";
import { structurePrompt } from "../prompts.ts";
import { locateQuoteSec } from "../transcript.ts";
import type { StructureIssue, StructureReview } from "../types.ts";

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

  const { system, user } = structurePrompt(ctx.timestamped);
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
