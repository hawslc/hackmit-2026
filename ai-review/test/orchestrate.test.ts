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
  it("fills every section when a lesson plan is given", async () => {
    const review = await runReview({ words, lessonPlan: "Recursion" }, { provider: "mock" });
    for (const key of ["delivery", "coverage", "teaching", "structure", "engagement", "confidence"] as const) {
      assert.equal(review[key].status, "ok", key);
    }
    assert.ok(review.summary && review.topPriority);
  });

  it("skips coverage without a lesson plan", async () => {
    const review = await runReview({ words }, { provider: "mock" });
    assert.equal(review.coverage.status, "skipped");
    assert.equal(review.delivery.status, "ok");
  });
});

describe("runReview failure containment", () => {
  it("turns a failing reviewer into an inline error and still returns a report", async () => {
    // The openai provider without a key makes every LLM call throw.
    delete process.env.OPENAI_API_KEY;
    const review = await runReview({ words, lessonPlan: "Recursion" }, { provider: "openai" });

    assert.equal(review.delivery.status, "error");
    assert.match(review.delivery.status === "error" ? review.delivery.error : "", /OPENAI_API_KEY/);
    // Synthesis falls back to a deterministic summary instead of throwing.
    assert.ok(review.summary && review.topPriority);
  });
});

describe("extractConcepts (mock provider)", () => {
  it("returns concepts with a 1-5 importance", async () => {
    const concepts = await extractConcepts([{ name: "a.md", text: "x" }], { provider: "mock" });
    assert.ok(concepts.length > 0);
    for (const c of concepts) assert.ok(c.importance === undefined || (c.importance >= 1 && c.importance <= 5));
  });
});
