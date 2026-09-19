// Teaching skills: three rubric categories scored 1–5 with a quote each.

import type { ReviewContext } from "../context.ts";
import { isMock } from "../env.ts";
import { completeJson } from "../llm.ts";
import { mockTeaching } from "../mock.ts";
import { teachingPrompt } from "../prompts.ts";
import type { TeachingCategory, TeachingReview, TeachingScore } from "../types.ts";

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

  const { system, user } = teachingPrompt(ctx.timestamped);
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
