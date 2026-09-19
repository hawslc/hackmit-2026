// runReview: the single entry point. Builds context, runs the reviewers in
// parallel (each contained — a throw or timeout becomes an inline error section,
// never blanks the report), skips coverage when there's no lesson plan, then
// synthesizes a summary + top priority.

import { buildContext } from "./context.ts";
import { resolveConfig } from "./env.ts";
import { reviewConfidence } from "./reviewers/confidence.ts";
import { reviewCoverage } from "./reviewers/coverage.ts";
import { reviewDelivery } from "./reviewers/delivery.ts";
import { reviewEngagement } from "./reviewers/engagement.ts";
import { reviewStructure } from "./reviewers/structure.ts";
import { reviewTeaching } from "./reviewers/teaching.ts";
import { synthesize, type Sections } from "./synthesize.ts";
import type { ReviewOptions, ReviewRequest, SectionResult, SessionReview } from "./types.ts";

function withTimeout<T>(p: Promise<T>, ms: number, task: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${task} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Run a reviewer and wrap its outcome; failures stay contained to this section. */
async function settle<T>(task: string, run: () => Promise<T>, timeoutMs: number): Promise<SectionResult<T>> {
  try {
    const data = await withTimeout(run(), timeoutMs, task);
    return { status: "ok", data };
  } catch (err) {
    return { status: "error", error: (err as Error).message };
  }
}

const SKIPPED_NO_PLAN = { status: "skipped", reason: "No lesson plan provided." } as const;

export async function runReview(req: ReviewRequest, opts: ReviewOptions = {}): Promise<SessionReview> {
  const cfg = resolveConfig(opts);
  const ctx = buildContext(req, cfg);
  const t = cfg.timeoutMs;

  const [delivery, coverage, teaching, structure, engagement, confidence] = await Promise.all([
    settle("delivery", () => reviewDelivery(ctx), t),
    ctx.lessonPlan ? settle("coverage", () => reviewCoverage(ctx), t) : Promise.resolve(SKIPPED_NO_PLAN),
    settle("teaching", () => reviewTeaching(ctx), t),
    settle("structure", () => reviewStructure(ctx), t),
    settle("engagement", () => reviewEngagement(ctx), t),
    settle("confidence", () => reviewConfidence(ctx), t),
  ]);

  const sections: Sections = { delivery, coverage, teaching, structure, engagement, confidence };
  const { summary, topPriority } = await synthesize(sections, cfg);

  return { summary, topPriority, ...sections };
}
