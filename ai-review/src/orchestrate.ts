// runReview: the single entry point. Builds context, runs the reviewers in
// parallel (each contained — a throw or timeout contributes no observations rather
// than blanking the report), skips coverage when there's no lesson plan, drops any
// observation whose quote isn't grounded in the transcript (mock output is trusted
// as-is), then coaches the pool into cards.

import type { SessionReview } from "@cadence/shared";
import { coach } from "./coach.ts";
import { buildContext } from "./context.ts";
import { isMock, resolveConfig } from "./llm/config.ts";
import { reviewConfidence } from "./reviewers/confidence.ts";
import { reviewCoverage } from "./reviewers/coverage.ts";
import { reviewDelivery } from "./reviewers/delivery.ts";
import { reviewEngagement } from "./reviewers/engagement.ts";
import { reviewStructure } from "./reviewers/structure.ts";
import { reviewTeaching } from "./reviewers/teaching.ts";
import { isQuoteGrounded } from "./transcript.ts";
import type { Observation, ReviewOptions, ReviewRequest } from "./types.ts";

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

/** Run a reviewer; a throw or timeout contributes no observations (failure stays contained). */
async function collect(run: () => Promise<Observation[]>, timeoutMs: number): Promise<Observation[]> {
  try {
    return await withTimeout(run(), timeoutMs, "reviewer");
  } catch {
    return [];
  }
}

export async function runReview(req: ReviewRequest, opts: ReviewOptions = {}): Promise<SessionReview> {
  const cfg = resolveConfig(opts);
  const ctx = buildContext(req, cfg);
  const t = cfg.timeoutMs;

  const groups = await Promise.all([
    collect(() => reviewDelivery(ctx), t),
    ctx.lessonPlan ? collect(() => reviewCoverage(ctx), t) : Promise.resolve<Observation[]>([]),
    collect(() => reviewTeaching(ctx), t),
    collect(() => reviewStructure(ctx), t),
    collect(() => reviewEngagement(ctx), t),
    collect(() => reviewConfidence(ctx), t),
  ]);

  const all = groups.flat();
  // Mock fixtures are trusted; real LLM quotes must be grounded in the transcript.
  const grounded = isMock(cfg)
    ? all
    : all.filter((o) => o.planGrounded || isQuoteGrounded(o.quote, ctx.segments));

  return coach(grounded, cfg);
}
