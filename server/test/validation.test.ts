import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LlmError } from "ai-review";
import { HttpError, llmErrorToHttp } from "../src/httpError.ts";
import { materialToLessonPlan } from "../src/lessonPlan.ts";
import { parseExtractConceptsRequest, parseReviewRequest } from "../src/validation.ts";

const word = { text: "hi", start: 0, end: 0.4 };

/** Asserts the call rejects with a 400 whose message matches. */
const rejects = (fn: () => unknown, message: RegExp) =>
  assert.throws(fn, (err) => err instanceof HttpError && err.status === 400 && message.test(err.message));

describe("parseReviewRequest", () => {
  it("accepts words alone", () => {
    assert.deepEqual(parseReviewRequest({ words: [word] }), { words: [word] });
  });

  it("accepts material with files and concepts, keeping only known fields", () => {
    const parsed = parseReviewRequest({
      words: [word],
      material: {
        files: [{ name: "a.md", text: "body", size: 4 }],
        concepts: [{ name: "Base case", importance: 5, origin: "user" }, { name: "Stack" }],
      },
    });
    assert.deepEqual(parsed.material, {
      files: [{ name: "a.md", text: "body" }],
      concepts: [{ name: "Base case", importance: 5 }, { name: "Stack" }],
    });
  });

  it("rejects a missing or empty transcript", () => {
    rejects(() => parseReviewRequest({}), /words must be an array/);
    rejects(() => parseReviewRequest({ words: [] }), /at least one word/);
  });

  it("names the field that is malformed", () => {
    rejects(() => parseReviewRequest({ words: [{ text: "hi", start: "0", end: 1 }] }), /words\[0\]\.start/);
    rejects(() => parseReviewRequest({ words: [word], material: { concepts: [{ importance: 3 }] } }), /concepts\[0\]\.name/);
    rejects(() => parseReviewRequest(null), /Body must be an object/);
  });
});

describe("parseExtractConceptsRequest", () => {
  it("requires at least one file with a name and text", () => {
    assert.deepEqual(parseExtractConceptsRequest({ files: [{ name: "a.md", text: "x" }] }), {
      files: [{ name: "a.md", text: "x" }],
    });
    rejects(() => parseExtractConceptsRequest({ files: [] }), /at least one file/);
    rejects(() => parseExtractConceptsRequest({ files: [{ name: "a.md" }] }), /files\[0\]\.text/);
  });
});

describe("materialToLessonPlan", () => {
  it("returns undefined when there is nothing to grade against", () => {
    assert.equal(materialToLessonPlan({ files: [], concepts: [] }), undefined);
  });

  it("lists concepts with importance, then the materials", () => {
    const plan = materialToLessonPlan({
      files: [{ name: "a.md", text: "Slide text" }],
      concepts: [{ name: "Base case", importance: 5 }, { name: "Stack" }],
    });
    assert.equal(plan, "Concepts to cover:\n- Base case (importance 5/5)\n- Stack\n\nMaterials:\nSlide text");
  });
});

describe("llmErrorToHttp", () => {
  const map = (kind: "timeout" | "not-configured" | "failed") =>
    llmErrorToHttp(new LlmError(kind, "raw"), "failed msg", "timeout msg") as HttpError;

  it("maps LLM failures to user-safe statuses", () => {
    assert.deepEqual([map("timeout").status, map("timeout").message], [504, "timeout msg"]);
    assert.deepEqual([map("failed").status, map("failed").message], [502, "failed msg"]);
    assert.equal(map("not-configured").status, 500);
    assert.doesNotMatch(map("failed").message, /raw/);
  });

  it("passes other errors through", () => {
    const err = new Error("boom");
    assert.equal(llmErrorToHttp(err, "a", "b"), err);
  });
});
