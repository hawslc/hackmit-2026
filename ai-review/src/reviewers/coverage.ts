// Coverage / scope: cross-reference the transcript against the lesson plan.
// Orchestrator only calls this when a lesson plan is present.

import type {
  ConceptCoverage,
  ConceptImportance,
  CoverageReview,
  CoverageStatus,
} from "@ta-coach/shared";
import type { ReviewContext } from "../context.ts";
import { completeJson } from "../llm/client.ts";
import { isMock } from "../llm/config.ts";
import { type Prompt, SHARED_RULES, transcriptBlock } from "../llm/prompt.ts";

// ---- Prompt ---------------------------------------------------------------

function prompt(transcript: string, lessonPlan: string): Prompt {
  return {
    system: `You compare what a teacher actually said against their lesson plan.
First identify the key concepts in the lesson plan. Tag each by how lost a student would be without it:
- "core": the lesson doesn't work without it,
- "supporting": helps understanding, fine to skip if short on time,
- "optional": extras, tangents, advanced asides.
Then mark whether each concept was "covered", "partial", or "missing" in the transcript. Paraphrases count as covered; "covered" and "partial" need a quote as evidence.
Tone: gaps are NOT failures — a teacher need not cover everything. Only missing "core" concepts are worth flagging hard; optional gaps are FYI.

Return JSON: {
  "concepts": [
    { "name": string,
      "importance": "core" | "supporting" | "optional",
      "status": "covered" | "partial" | "missing",
      "evidence": string,               // transcript quote; "" if missing
      "note": string }                  // short, kind note (esp. for gaps)
  ]
}
${SHARED_RULES}`,
    user: `Lesson plan:\n"""\n${lessonPlan}\n"""\n\n${transcriptBlock(transcript)}`,
  };
}

// ---- Mock (LLM_PROVIDER=mock) ---------------------------------------------

const mockCoverage: CoverageReview = {
  coveredCount: 3,
  totalCount: 4,
  concepts: [
    {
      name: "Base case",
      importance: "core",
      status: "covered",
      evidence: "every recursion needs a base case, otherwise it never stops",
      note: "Clearly introduced and motivated.",
    },
    {
      name: "Recursive case",
      importance: "core",
      status: "covered",
      evidence: "the function calls itself on a smaller input",
      note: "Covered with the factorial example.",
    },
    {
      name: "The call stack",
      importance: "supporting",
      status: "partial",
      evidence: "each call waits for the next one to finish",
      note: "Mentioned in passing — a quick diagram of stacked calls would land it.",
    },
    {
      name: "Infinite recursion / stack overflow",
      importance: "supporting",
      status: "missing",
      evidence: "",
      note: "Fine to skip for an intro, but a one-line warning about forgetting the base case would help.",
    },
  ],
};

// ---- Review ---------------------------------------------------------------

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

  const { system, user } = prompt(ctx.timestamped, ctx.lessonPlan ?? "");
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
