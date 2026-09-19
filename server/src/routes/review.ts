// Review endpoint (new; not yet called by the client). Wraps ai-review's
// runReview. Accepts either a raw `lessonPlan` string or a `material`
// (LectureMaterial) it derives one from. With LLM_PROVIDER unset, ai-review
// defaults to mock, so this returns a full canned SessionReview offline.

import express from "express";
import { runReview, type WordTiming } from "ai-review";
import { HttpError } from "../httpError.ts";

interface LectureMaterialLike {
  files?: { name?: string; text?: string }[];
  concepts?: { name?: string; source?: string; importance?: number }[];
}

interface ReviewBody {
  words?: WordTiming[];
  transcript?: string;
  lessonPlan?: string;
  material?: LectureMaterialLike;
}

export const reviewRouter = express.Router();

reviewRouter.post("/", async (req, res) => {
  const body = (req.body ?? {}) as ReviewBody;
  const { words } = body;
  if (!Array.isArray(words) || words.length === 0) {
    throw new HttpError(400, "Send { words: WordTiming[] } — a non-empty transcript.");
  }

  const lessonPlan = body.lessonPlan ?? (body.material ? materialToLessonPlan(body.material) : undefined);
  const review = await runReview({ words, transcript: body.transcript, lessonPlan });
  res.json(review);
});

/** Turn a LectureMaterial into a plain-text lesson plan for the coverage reviewer. */
function materialToLessonPlan(m: LectureMaterialLike): string | undefined {
  const parts: string[] = [];

  const concepts = (m.concepts ?? []).filter((c) => c?.name);
  if (concepts.length) {
    parts.push("Concepts to cover:");
    for (const c of concepts) {
      const imp = typeof c.importance === "number" ? ` (importance ${c.importance}/5)` : "";
      parts.push(`- ${c.name}${imp}`);
    }
  }

  const corpus = (m.files ?? [])
    .map((f) => f?.text)
    .filter((t): t is string => Boolean(t))
    .join("\n\n");
  if (corpus) parts.push(`\nMaterials:\n${corpus}`);

  const out = parts.join("\n").trim();
  return out || undefined;
}
