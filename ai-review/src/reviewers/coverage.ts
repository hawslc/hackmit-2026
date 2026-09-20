// Coverage / scope: cross-reference the transcript against the lesson plan.
// Only missing/partial CORE concepts escalate to a coaching observation — grounded
// by the plan (the one justified absence signal). Orchestrator calls this only when
// a lesson plan is present.

import type { ConceptImportance, CoverageStatus } from "@cadence/shared";
import type { ReviewContext } from "../context.ts";
import type { Observation } from "../types.ts";
import { completeJson } from "../llm/client.ts";
import { isMock } from "../llm/config.ts";
import { type Prompt, transcriptBlock } from "../llm/prompt.ts";

// ---- Prompt ---------------------------------------------------------------

function prompt(transcript: string, lessonPlan: string): Prompt {
  return {
    system: `You compare what a teacher actually said against their lesson plan.
First identify the key concepts in the lesson plan. Tag each by how lost a student would be without it:
- "core": the lesson doesn't work without it,
- "supporting": helps understanding, fine to skip if short on time,
- "optional": extras, tangents, advanced asides.
Then mark whether each concept was "covered", "partial", or "missing" in the transcript. Paraphrases count as covered.
Gaps are NOT failures — a teacher need not cover everything.

Return a single JSON object and nothing else:
{ "concepts": [ { "name": string, "importance": "core" | "supporting" | "optional", "status": "covered" | "partial" | "missing" } ] }`,
    user: `Lesson plan:\n"""\n${lessonPlan}\n"""\n\n${transcriptBlock(transcript)}`,
  };
}

// ---- Mock (LLM_PROVIDER=mock) ---------------------------------------------
// Core concepts covered → no coaching from coverage in the mock (focus comes from teaching).

const mockCoverage: Observation[] = [];

// ---- Review ---------------------------------------------------------------

interface RawConcept {
  name?: string;
  importance?: string;
  status?: string;
}
interface RawCoverage {
  concepts?: RawConcept[];
}

const IMPORTANCE: ConceptImportance[] = ["core", "supporting", "optional"];
const STATUS: CoverageStatus[] = ["covered", "partial", "missing"];
const asImportance = (s: string | undefined): ConceptImportance =>
  IMPORTANCE.includes(s as ConceptImportance) ? (s as ConceptImportance) : "supporting";
const asStatus = (s: string | undefined): CoverageStatus =>
  STATUS.includes(s as CoverageStatus) ? (s as CoverageStatus) : "missing";

export async function reviewCoverage(ctx: ReviewContext): Promise<Observation[]> {
  if (isMock(ctx.cfg)) return mockCoverage;

  const { system, user } = prompt(ctx.timestamped, ctx.lessonPlan ?? "");
  const raw = await completeJson<RawCoverage>({ task: "content-review", system, user }, ctx.cfg);

  return (raw.concepts ?? [])
    .filter((c): c is RawConcept & { name: string } => Boolean(c?.name))
    .filter((c) => asImportance(c.importance) === "core" && asStatus(c.status) !== "covered")
    .map((c): Observation => ({
      category: "coverage",
      quote: "",
      atSec: 0,
      observation: `The lesson plan lists "${c.name}" as a core idea, and it ${
        asStatus(c.status) === "partial" ? "only came up in passing" : "didn't come up"
      }.`,
      whyItMatters: "The rest of the lesson leans on this idea, so a gap here compounds.",
      suggestion: `Work "${c.name}" in early, right after your setup, before the example.`,
      planGrounded: true,
    }));
}
