// Coverage / scope: cross-reference the transcript against the lesson plan.
// Orchestrator only calls this when a lesson plan is present.

import type { ReviewContext } from "../context.ts";
import { isMock } from "../env.ts";
import { completeJson } from "../llm.ts";
import { mockCoverage } from "../mock.ts";
import { coveragePrompt } from "../prompts.ts";
import type {
  ConceptCoverage,
  ConceptImportance,
  CoverageReview,
  CoverageStatus,
} from "../types.ts";

interface RawConcept {
  name?: string;
  importance?: string;
  status?: string;
  evidence?: string;
  note?: string;
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

export async function reviewCoverage(ctx: ReviewContext): Promise<CoverageReview> {
  if (isMock(ctx.cfg)) return mockCoverage;

  const { system, user } = coveragePrompt(ctx.timestamped, ctx.lessonPlan ?? "");
  const raw = await completeJson<RawCoverage>({ task: "content-review", system, user }, ctx.cfg);

  const concepts: ConceptCoverage[] = (raw.concepts ?? [])
    .filter((c): c is RawConcept & { name: string } => Boolean(c?.name))
    .map((c) => {
      const status = asStatus(c.status);
      const concept: ConceptCoverage = {
        name: c.name,
        importance: asImportance(c.importance),
        status,
      };
      if (c.evidence && status !== "missing") concept.evidence = c.evidence;
      if (c.note) concept.note = c.note;
      return concept;
    });

  const coveredCount = concepts.filter((c) => c.status === "covered").length;
  return { coveredCount, totalCount: concepts.length, concepts };
}
