import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isQuoteGrounded, splitSentences } from "../src/transcript.ts";
import { parseObservations } from "../src/reviewers/observation.ts";
import type { WordTiming } from "@cadence/shared";

const words: WordTiming[] = "Recursion is when a function calls itself until it stops."
  .split(" ")
  .map((text, i) => ({ text, start: i * 0.4, end: i * 0.4 + 0.35 }));
const segments = splitSentences(words);

describe("isQuoteGrounded", () => {
  it("accepts a verbatim substring of the transcript", () => {
    assert.equal(isQuoteGrounded("a function calls itself", segments), true);
  });

  it("accepts a near-match sharing enough words (punctuation/case differ)", () => {
    assert.equal(isQuoteGrounded("Recursion is when a function CALLS itself!", segments), true);
  });

  it("rejects a quote the transcript never contains", () => {
    assert.equal(isQuoteGrounded("let's compute factorial of three", segments), false);
  });

  it("rejects an empty quote", () => {
    assert.equal(isQuoteGrounded("", segments), false);
  });
});

describe("parseObservations", () => {
  it("drops items without a quote, resolves atSec, caps at 3", () => {
    const raw = {
      observations: [
        { quote: "a function calls itself", observation: "o1", whyItMatters: "w1", suggestion: "s1" },
        { observation: "no quote", whyItMatters: "w" },
        { quote: "until it stops", observation: "o2", whyItMatters: "w2" },
        { quote: "Recursion is when", observation: "o3", whyItMatters: "w3" },
        { quote: "extra", observation: "o4", whyItMatters: "w4" },
      ],
    };
    const out = parseObservations(raw, "teaching", segments);
    assert.equal(out.length, 3);
    assert.equal(out[0]!.category, "teaching");
    assert.equal(out[0]!.quote, "a function calls itself");
    assert.equal(typeof out[0]!.atSec, "number");
    assert.equal(out[1]!.quote, "until it stops"); // the un-quoted item was dropped
    assert.equal(out[1]!.suggestion, undefined);
  });
});
