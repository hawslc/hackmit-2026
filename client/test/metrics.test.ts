import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MetricsAccumulator } from "../src/live/metrics.ts";

describe("MetricsAccumulator.snapshot pendingText", () => {
  it("counts in-flight partial words and fillers toward live metrics", () => {
    const acc = new MetricsAccumulator(0);
    acc.addCommitted("um so the base case", [
      { text: "um", start: 0, end: 0.3 },
      { text: "so", start: 0.4, end: 0.5 },
      { text: "the", start: 0.5, end: 0.6 },
      { text: "base", start: 0.6, end: 0.8 },
      { text: "case", start: 0.8, end: 1.0 },
    ]);

    const live = acc.snapshot(60_000, null, null, undefined, "uh is like this");
    assert.equal(live.wordCount, 9);
    assert.equal(live.fillerCount, 4); // um, so, uh, like
    assert.equal(live.wpm, 9);
  });

  it("drops pending words once the segment commits (no double counting)", () => {
    const acc = new MetricsAccumulator(0);
    acc.addCommitted("one two three", [
      { text: "one", start: 0, end: 0.3 },
      { text: "two", start: 0.4, end: 0.5 },
      { text: "three", start: 0.5, end: 0.8 },
    ]);

    const midSentence = acc.snapshot(60_000, null, null, undefined, "four five");
    assert.equal(midSentence.wordCount, 5);

    // Commit what was pending; the partial clears in the caller.
    acc.addCommitted("four five", [
      { text: "four", start: 1.0, end: 1.3 },
      { text: "five", start: 1.4, end: 1.7 },
    ]);
    const committed = acc.snapshot(60_000, null, null, undefined, "");
    assert.equal(committed.wordCount, 5);
  });

  it("leaves committed metrics identical when no pending text", () => {
    const acc = new MetricsAccumulator(0);
    acc.addCommitted("hello world", [
      { text: "hello", start: 0, end: 0.4 },
      { text: "world", start: 0.5, end: 0.9 },
    ]);
    const without = acc.snapshot(60_000);
    const withEmpty = acc.snapshot(60_000, null, null, undefined, "  ");
    assert.equal(without.wordCount, 2);
    assert.equal(withEmpty.wordCount, 2);
    assert.equal(withEmpty.fillerCount, 0);
  });
});
