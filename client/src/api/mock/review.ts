// Returns a full wire-shaped SessionReview, so mock mode exercises the same
// mapping (`toReviewView`) as the real server. Handy triggers, matched against
// uploaded file names:
//   "fail-review" → the whole request fails
//   "fail-facts"  → the factual check errors inline
//   "no-facts"    → no factual issues (the block is hidden)
//   no concepts   → coverage is skipped (the Content section and its gaps)

import type { ConceptCoverage, ConceptImportance, CoverageReview, FactualIssue, SessionReview } from "@ta-coach/shared";
import type { Concept, LectureMaterial } from "../../types";
import type { ReviewApi } from "../types";
import { jitter, sleep } from "./delay";

const NO_CONTENT = "Add materials or key concepts to get a content review.";

/** User-added concepts (no importance) count as core: the TA said students must learn them. */
function importanceOf({ importance }: Concept): ConceptImportance {
  if (importance === undefined || importance >= 4) return "core";
  return importance >= 3 ? "supporting" : "optional";
}

/** The first three concepts are flagged: missing, partial, missing. */
function mockCoverage({ concepts }: LectureMaterial): CoverageReview {
  const covered = (c: Concept): ConceptCoverage => ({
    name: c.name,
    importance: importanceOf(c),
    status: "covered",
    evidence: "so the base case is where the recursion stops",
  });
  const flagged = (c: Concept, i: number): ConceptCoverage => ({
    name: c.name,
    importance: importanceOf(c),
    status: i === 1 ? "partial" : "missing",
    note: i === 1 ? "Mentioned in passing. A quick example would land it." : "Fine to skip for an intro, but worth a line.",
  });
  const rows = concepts.map((c, i) => (i < 3 ? flagged(c, i) : covered(c)));
  return { coveredCount: rows.filter((r) => r.status === "covered").length, totalCount: rows.length, concepts: rows };
}

function mockIssue({ files }: LectureMaterial): FactualIssue {
  const base = {
    quote: "So one plus two is four, which is why the loop runs again.",
    problem: "1 + 2 equals 3, not 4.",
    correction: "1 + 2 = 3",
  };
  return files.length
    ? {
        ...base,
        basis: "materials",
        source: {
          label: `${files[0]!.name} · slide 7`,
          excerpt: "Worked example: 1 + 2 = 3, so the loop runs a third time.",
        },
      }
    : {
        ...base,
        basis: "general",
        source: { label: "Wikipedia: Addition", url: "https://en.wikipedia.org/wiki/Addition" },
      };
}

function mockReview(material: LectureMaterial): SessionReview {
  const named = (marker: string) => material.files.some((f) => f.name.includes(marker));
  const hasConcepts = material.concepts.length > 0;

  return {
    summary:
      "A confident first pass. Your delivery was clear; the biggest gains are in covering the key ideas and checking that students follow.",
    topPriority:
      "Cover every core concept before moving on, and pause after the hardest step to check understanding.",
    delivery: {
      status: "ok",
      data: {
        note: "Mostly clear and to the point. A couple of spots run long.",
        moments: [
          {
            quote: "and that's kind of what Big-O is, you know, sort of, the growth thing",
            atSec: 41,
            issue: "rambling",
            suggestion: "Say it once: \"Big-O describes how running time grows with input size.\"",
          },
        ],
      },
    },
    coverage: hasConcepts ? { status: "ok", data: mockCoverage(material) } : { status: "skipped", reason: NO_CONTENT },
    teaching: {
      status: "ok",
      data: {
        scores: [
          {
            category: "accessible_language",
            score: 4,
            strength: "You defined jargon in plain words.",
            suggestion: "Introduce one technical term at a time.",
            evidence: "the base case is the stopping condition",
          },
          {
            category: "analogies_examples",
            score: 4,
            strength: "A concrete worked example came before the rule.",
            suggestion: "Add an everyday analogy for the structure.",
            evidence: "let's compute factorial of 3 step by step",
          },
          {
            category: "checks_for_understanding",
            score: 2,
            strength: "You invited a question near the end.",
            suggestion: "Swap \"make sense?\" for an open prompt like \"What happens if we remove the base case?\"",
            evidence: "okay, everyone with me? great, moving on",
          },
        ],
      },
    },
    structure: {
      status: "ok",
      data: {
        note: "Good arc overall: definition, example, close.",
        issues: [
          {
            problem: "Jumps from the definition straight into an example.",
            suggestion: "Add a one-line bridge before the example.",
            quote: "okay so let's compute factorial of 3",
            atSec: 58,
          },
        ],
      },
    },
    engagement: {
      status: "ok",
      data: {
        note: "Warm and approachable, with one nice invitation to think.",
        observations: [
          {
            quote: "what do you think happens if the function never reaches the base case?",
            atSec: 96,
            note: "Open question that invites prediction.",
          },
        ],
      },
    },
    confidence: {
      status: "ok",
      data: {
        note: "Confident overall; a few fillers early on are easy to trim.",
        fillersPerMinute: 4.2,
        instances: [{ quote: "so, um, basically the next thing is", atSec: 12, type: "filler" }],
      },
    },
    factualIssues: named("fail-facts")
      ? { status: "error", error: "We couldn't run the fact check this time." }
      : { status: "ok", data: named("no-facts") ? [] : [mockIssue(material)] },
  };
}

export const mockReviewApi: ReviewApi = {
  async requestReview(material, _session, signal) {
    await sleep(jitter(1500, 2500));
    signal?.throwIfAborted();
    if (material.files.some((f) => f.name.includes("fail-review"))) throw new Error("Mock review failure");
    return mockReview(material);
  },
};
