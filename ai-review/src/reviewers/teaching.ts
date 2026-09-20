// Teaching skills: three rubric categories scored 1–5 with a quote each.

import type { TeachingCategory, TeachingReview, TeachingScore } from "@cadence/shared";
import type { ReviewContext } from "../context.ts";
import { completeJson } from "../llm/client.ts";
import { isMock } from "../llm/config.ts";
import { type Prompt, SHARED_RULES, transcriptBlock } from "../llm/prompt.ts";

// ---- Prompt ---------------------------------------------------------------

function prompt(transcript: string): Prompt {
  return {
    system: `You score teaching skill from the transcript, 1–5 for each category, with a quote as evidence for each score.

accessible_language — can a student who's behind follow this?
  Good: defines jargon before using it; short sentences, one idea at a time; builds on prior knowledge.
  Red flags: undefined acronyms, stacked technical terms, "obviously"/"trivially".
analogies_examples — does the abstract idea get made concrete?
  Good: at least one concrete example per new concept; analogies that map the structure of the idea; worked example before the general rule.
  Red flags: only abstract definitions; an analogy that breaks on the key point.
checks_for_understanding — are students made to think?
  Good: open questions ("Why do you think…?", "What would happen if…?"); asks students to justify or predict; pauses after a question.
  Red flags: "Any questions?"/"Make sense?" as the only check; answering one's own question immediately.

Return JSON: {
  "scores": [
    { "category": "accessible_language" | "analogies_examples" | "checks_for_understanding",
      "score": 1 | 2 | 3 | 4 | 5,
      "strength": string,               // what they did well
      "suggestion": string,             // one concrete improvement
      "evidence": string }              // transcript quote
  ]
}
Include exactly one entry per category.
${SHARED_RULES}`,
    user: transcriptBlock(transcript),
  };
}

// ---- Mock (LLM_PROVIDER=mock) ---------------------------------------------

const mockTeaching: TeachingReview = {
  scores: [
    {
      category: "accessible_language",
      score: 4,
      strength: "You defined \"base case\" in plain words before using it.",
      suggestion: "Watch the stacked terms in one breath — introduce \"stack frame\" on its own.",
      evidence: "the base case is the stopping condition, the simplest version of the problem",
    },
    {
      category: "analogies_examples",
      score: 4,
      strength: "Factorial was a great concrete worked example before the general rule.",
      suggestion: "Add a second everyday analogy (e.g. Russian nesting dolls) for the structure.",
      evidence: "let's compute factorial of 3 step by step",
    },
    {
      category: "checks_for_understanding",
      score: 2,
      strength: "You did pause to invite a question near the end.",
      suggestion: "Swap \"Does that make sense?\" for an open prompt like \"What would happen if we removed the base case?\"",
      evidence: "does that make sense to everyone?",
    },
  ],
};

// ---- Review ---------------------------------------------------------------

interface RawScore {
  category?: string;
  score?: number;
  strength?: string;
  suggestion?: string;
  evidence?: string;
}
interface RawTeaching {
  scores?: RawScore[];
}

const CATEGORIES: TeachingCategory[] = [
  "accessible_language",
  "analogies_examples",
  "checks_for_understanding",
];

const clampScore = (n: number | undefined): number =>
  Math.min(5, Math.max(1, Math.round(typeof n === "number" ? n : 3)));

export async function reviewTeaching(ctx: ReviewContext): Promise<TeachingReview> {
  if (isMock(ctx.cfg)) return mockTeaching;

  const { system, user } = prompt(ctx.timestamped);
  const raw = await completeJson<RawTeaching>({ task: "teaching-review", system, user }, ctx.cfg);

  const byCategory = new Map<TeachingCategory, RawScore>();
  for (const s of raw.scores ?? []) {
    if (CATEGORIES.includes(s?.category as TeachingCategory)) {
      byCategory.set(s.category as TeachingCategory, s);
    }
  }

  // Emit exactly one entry per category, in rubric order, so the UI is stable.
  const scores: TeachingScore[] = CATEGORIES.map((category) => {
    const s = byCategory.get(category);
    const entry: TeachingScore = {
      category,
      score: clampScore(s?.score),
      strength: s?.strength ?? "",
      suggestion: s?.suggestion ?? "",
    };
    if (s?.evidence) entry.evidence = s.evidence;
    return entry;
  });

  return { scores };
}
