import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionReview } from "@ta-coach/shared";
import { isCoreGap, pickHighlighted, toReviewView } from "../src/lib/reviewView.ts";

const ok = <T>(data: T) => ({ status: "ok", data }) as const;

const review: SessionReview = {
  summary: "s",
  topPriority: "p",
  delivery: ok({ note: "Clear.", moments: [{ quote: "q", atSec: 1, issue: "verbose", suggestion: "Tighten it." }] }),
  coverage: ok({
    coveredCount: 1,
    totalCount: 4,
    concepts: [
      { name: "A", importance: "core", status: "covered" },
      { name: "B", importance: "core", status: "partial", note: "In passing." },
      { name: "C", importance: "optional", status: "missing" },
      { name: "D", importance: "supporting", status: "missing" },
    ],
  }),
  teaching: ok({
    scores: [
      { category: "accessible_language", score: 5, strength: "", suggestion: "a", evidence: "ea" },
      { category: "analogies_examples", score: 4, strength: "", suggestion: "b" },
      { category: "checks_for_understanding", score: 2, strength: "", suggestion: "c", evidence: "ec" },
    ],
  }),
  structure: { status: "skipped", reason: "nope" },
  engagement: { status: "error", error: "boom" },
  confidence: ok({ note: "Steady.", fillersPerMinute: 4.25, instances: [{ quote: "um", atSec: 2, type: "filler" }] }),
};

const view = toReviewView(review);
const detail = (id: string) => {
  const result = view.sections.find((s) => s.id === id)!.result;
  assert.equal(result.status, "ok");
  return result.status === "ok" ? result.data : never();
};
const never = (): never => {
  throw new Error("unreachable");
};

describe("toReviewView", () => {
  it("maps every reviewer to a section, in display order", () => {
    assert.deepEqual(
      view.sections.map((s) => s.id),
      ["delivery", "content", "teaching", "structure", "engagement", "confidence"],
    );
  });

  it("passes skipped and failed reviewers through as-is", () => {
    assert.deepEqual(view.sections.find((s) => s.id === "structure")!.result, { status: "skipped", reason: "nope" });
    assert.deepEqual(view.sections.find((s) => s.id === "engagement")!.result, { status: "error", error: "boom" });
  });

  it("scores content by coverage, counting partial as half", () => {
    assert.equal(detail("content").score, 38); // (1 + 0.5) / 4
  });

  it("scores teaching as the mean out of 5, weakest suggestion first", () => {
    const teaching = detail("teaching");
    assert.equal(teaching.score, 73); // mean 3.67 / 5
    assert.deepEqual(teaching.feedback[0], { point: "c", quote: "ec" });
  });

  it("leaves unscored sections without a score", () => {
    assert.equal(detail("delivery").score, undefined);
    assert.equal(detail("confidence").score, undefined);
  });

  it("reports filler rate to one decimal", () => {
    assert.match(detail("confidence").summary, /4\.3 filler words per minute/);
  });

  it("breaks content down per concept, covered first then gaps", () => {
    const { concepts } = detail("content");
    assert.deepEqual(
      concepts?.map((c) => [c.name, c.status]),
      [["A", "covered"], ["B", "partial"], ["C", "missing"], ["D", "missing"]],
    );
    assert.equal(concepts?.find((c) => c.name === "B")?.detail, "In passing.");
  });

  it("lists only uncovered concepts as gaps", () => {
    assert.equal(view.gaps.status, "ok");
    const gaps = view.gaps.status === "ok" ? view.gaps.data : [];
    assert.deepEqual(gaps.map((g) => [g.concept, g.status]), [["B", "partial"], ["C", "missing"], ["D", "missing"]]);
    assert.deepEqual(gaps.filter(isCoreGap).map((g) => g.concept), ["B"]);
  });

  it("skips fact checking when the server doesn't provide it", () => {
    assert.equal(view.factualIssues.status, "skipped");
  });

  it("propagates a skipped coverage reviewer to both content and gaps", () => {
    const skipped = toReviewView({ ...review, coverage: { status: "skipped", reason: "No plan" } });
    assert.equal(skipped.gaps.status, "skipped");
    assert.equal(skipped.sections.find((s) => s.id === "content")!.result.status, "skipped");
  });
});

describe("pickHighlighted", () => {
  it("picks the lowest-scoring scored sections", () => {
    assert.deepEqual([...pickHighlighted(view.sections, 1)], ["content"]);
    assert.deepEqual([...pickHighlighted(view.sections, 2)], ["content", "teaching"]);
  });
});
