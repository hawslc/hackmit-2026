import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coach, rankObservations } from "../src/coach.ts";
import { resolveConfig } from "../src/llm/config.ts";
import type { Observation } from "../src/types.ts";

const obs = (category: Observation["category"], observation: string): Observation => ({
  category,
  quote: `q-${observation}`,
  atSec: 1,
  observation,
  whyItMatters: "w",
  suggestion: "s",
});

describe("rankObservations", () => {
  it("orders coverage > teaching > structure > engagement > delivery > confidence, stable within ties", () => {
    const ranked = rankObservations([
      obs("delivery", "d"),
      obs("coverage", "c"),
      obs("teaching", "t"),
      obs("confidence", "f"),
    ]);
    assert.deepEqual(ranked.map((o) => o.category), ["coverage", "teaching", "delivery", "confidence"]);
  });
});

describe("coach (mock provider = deterministic fallback)", () => {
  const cfg = resolveConfig({ provider: "mock" });

  it("returns insufficient when there are no observations", async () => {
    const review = await coach([], cfg);
    assert.equal(review.evidenceState, "insufficient");
    assert.equal(review.focus, null);
    assert.deepEqual(review.more, []);
  });

  it("builds a focus from the top-ranked observation and caps more at 3", async () => {
    const review = await coach(
      [obs("delivery", "d"), obs("teaching", "t"), obs("structure", "s"), obs("engagement", "e"), obs("confidence", "f")],
      cfg,
    );
    assert.equal(review.evidenceState, "coached");
    assert.equal(review.focus?.category, "teaching"); // teaching outranks delivery
    assert.equal(review.focus?.quote, "q-t");
    assert.equal(review.focus?.whatHappened, "t");
    assert.equal(review.focus?.tryInstead, "s"); // suggestion seeds tryInstead in fallback
    assert.ok(review.focus?.practiceGoal.length);
    assert.equal(review.more.length, 3);
  });
});
