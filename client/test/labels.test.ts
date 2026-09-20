import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categoryLabel } from "../src/lib/cardLabels.ts";

describe("categoryLabel", () => {
  it("labels coverage as Content and covers every category", () => {
    assert.equal(categoryLabel.coverage, "Content");
    assert.deepEqual(
      Object.keys(categoryLabel).sort(),
      ["confidence", "coverage", "delivery", "engagement", "structure", "teaching"],
    );
  });
});
