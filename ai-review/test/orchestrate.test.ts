import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { WordTiming } from "@cadence/shared";
import { extractConcepts, runReview } from "../src/index.ts";

const words: WordTiming[] = "So, um, recursion is when a function calls itself.".split(" ").map((text, i) => ({
  text,
  start: i * 0.4,
  end: i * 0.4 + 0.35,
}));

const savedKey = process.env.OPENAI_API_KEY;
afterEach(() => {
  if (savedKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = savedKey;
});

describe("runReview (mock provider)", () => {
  it("returns a grounded focus card", async () => {
    const review = await runReview({ words, lessonPlan: "Recursion" }, { provider: "mock" });
    assert.equal(review.evidenceState, "coached");
    assert.ok(review.focus, "expected a focus card");
    assert.ok(review.focus!.headline.length);
    assert.ok(review.focus!.tryInstead.length);
    assert.ok(review.focus!.practiceGoal.length);
    assert.ok(Array.isArray(review.more));
  });

  it("still coaches without a lesson plan (coverage contributes nothing)", async () => {
    const review = await runReview({ words }, { provider: "mock" });
    assert.equal(review.evidenceState, "coached");
    assert.notEqual(review.focus, null);
    // No coverage observation can appear without a plan.
    assert.equal([review.focus, ...review.more].some((c) => c && c.category === "coverage"), false);
  });
});

describe("runReview failure containment", () => {
  it("returns insufficient (not an error) when every reviewer fails", async () => {
    // The openai provider without a key makes every LLM call throw → no observations.
    delete process.env.OPENAI_API_KEY;
    const review = await runReview({ words, lessonPlan: "Recursion" }, { provider: "openai" });
    assert.equal(review.evidenceState, "insufficient");
    assert.equal(review.focus, null);
    assert.deepEqual(review.more, []);
  });
});

describe("extractConcepts (mock provider)", () => {
  it("returns concepts with a 1-5 importance", async () => {
    const concepts = await extractConcepts([{ name: "a.md", text: "x" }], { provider: "mock" });
    assert.ok(concepts.length > 0);
    for (const c of concepts) assert.ok(c.importance === undefined || (c.importance >= 1 && c.importance <= 5));
  });
});
