import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isQuoteGrounded, splitSentences } from "../src/transcript.ts";
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
