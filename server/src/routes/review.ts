// POST /api/review: wraps ai-review's runReview. With LLM_PROVIDER unset,
// ai-review defaults to mock, so this returns a full canned SessionReview offline.

import type { SessionReview } from "@cadence/shared";
import express from "express";
import { runReview } from "ai-review";
import { materialToLessonPlan } from "../lessonPlan.ts";
import { parseReviewRequest } from "../validation.ts";

export const reviewRouter = express.Router();

reviewRouter.post("/", async (req, res) => {
  const { words, material } = parseReviewRequest(req.body);
  const lessonPlan = material && materialToLessonPlan(material);

  const review: SessionReview = await runReview({ words, lessonPlan });
  res.json(review);
});
