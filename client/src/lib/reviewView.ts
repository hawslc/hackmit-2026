// Maps the server's SessionReview (one section per reviewer) onto the view model
// the Review screen renders. Pure functions: no React, no fetching.

import type {
  ConfidenceReview,
  CoverageReview,
  DeliveryReview,
  EngagementReview,
  SectionResult,
  SessionReview,
  StructureReview,
  TeachingCategory,
  TeachingReview,
} from "@ta-coach/shared";
import type { ContentGap, ReviewSection, ReviewView, SectionDetail, SectionId } from "../types";

const TEACHING_LABELS: Record<TeachingCategory, string> = {
  accessible_language: "accessible language",
  analogies_examples: "analogies & examples",
  checks_for_understanding: "checks for understanding",
};

const FACTS_UNAVAILABLE = "Fact checking isn't available yet.";

/** Applies `fn` to a section's data; skipped and failed sections pass through unchanged. */
function mapResult<T, U>(result: SectionResult<T>, fn: (data: T) => U): SectionResult<U> {
  return result.status === "ok" ? { status: "ok", data: fn(result.data) } : result;
}

const percent = (fraction: number) => Math.round(fraction * 100);
const oneDecimal = (n: number) => Math.round(n * 10) / 10;

// ---- One mapper per reviewer -------------------------------------------------

function deliveryDetail({ note, moments }: DeliveryReview): SectionDetail {
  return { summary: note, feedback: moments.map((m) => ({ point: m.suggestion, quote: m.quote })) };
}

function contentDetail({ concepts, coveredCount, totalCount }: CoverageReview): SectionDetail {
  const partial = concepts.filter((c) => c.status === "partial").length;
  return {
    score: totalCount === 0 ? undefined : percent((coveredCount + partial / 2) / totalCount),
    summary: `You covered ${coveredCount} of ${totalCount} concepts.`,
    feedback: concepts
      .filter((c) => c.status !== "covered")
      .map((c) => ({ point: c.note || `${c.name} wasn't fully covered.`, quote: c.evidence || undefined })),
  };
}

function teachingDetail({ scores }: TeachingReview): SectionDetail {
  if (scores.length === 0) return { summary: "", feedback: [] };
  const ranked = [...scores].sort((a, b) => a.score - b.score);
  const weakest = ranked[0]!;
  const strongest = ranked[ranked.length - 1]!;
  const mean = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  return {
    score: percent(mean / 5),
    summary: `Strongest: ${TEACHING_LABELS[strongest.category]}. Biggest opportunity: ${TEACHING_LABELS[weakest.category]}.`,
    feedback: ranked.map((s) => ({ point: s.suggestion, quote: s.evidence })),
  };
}

function structureDetail({ note, issues }: StructureReview): SectionDetail {
  return {
    summary: note,
    feedback: issues.map((i) => ({ point: `${i.problem} ${i.suggestion}`.trim(), quote: i.quote })),
  };
}

function engagementDetail({ note, observations }: EngagementReview): SectionDetail {
  return { summary: note, feedback: observations.map((o) => ({ point: o.note, quote: o.quote })) };
}

function confidenceDetail({ note, fillersPerMinute, instances }: ConfidenceReview): SectionDetail {
  return {
    summary: `${note} (${oneDecimal(fillersPerMinute)} filler words per minute)`,
    feedback: instances.map((i) => ({
      point: i.type === "hedge" ? "Hedging language" : "Filler word",
      quote: i.quote,
    })),
  };
}

function coverageGaps({ concepts }: CoverageReview): ContentGap[] {
  return concepts.flatMap((c) =>
    c.status === "covered" ? [] : [{ concept: c.name, importance: c.importance, status: c.status, note: c.note }],
  );
}

// ---- Public API --------------------------------------------------------------

export function toReviewView(review: SessionReview): ReviewView {
  const section = <T>(id: SectionId, title: string, result: SectionResult<T>, detail: (data: T) => SectionDetail): ReviewSection => ({
    id,
    title,
    result: mapResult(result, detail),
  });

  return {
    summary: review.summary,
    topPriority: review.topPriority,
    sections: [
      section("delivery", "Clarity & conciseness", review.delivery, deliveryDetail),
      section("content", "Content", review.coverage, contentDetail),
      section("teaching", "Teaching", review.teaching, teachingDetail),
      section("structure", "Structure", review.structure, structureDetail),
      section("engagement", "Engagement", review.engagement, engagementDetail),
      section("confidence", "Confidence", review.confidence, confidenceDetail),
    ],
    gaps: mapResult(review.coverage, coverageGaps),
    factualIssues: review.factualIssues ?? { status: "skipped", reason: FACTS_UNAVAILABLE },
  };
}

/** Ids of the `count` lowest-scoring sections. Failed, skipped and unscored sections aren't ranked. */
export function pickHighlighted(sections: ReviewSection[], count: number): Set<SectionId> {
  const scored = sections.flatMap((s) =>
    s.result.status === "ok" && s.result.data.score !== undefined ? [{ id: s.id, score: s.result.data.score }] : [],
  );
  // Array.sort is stable, so ties keep display order.
  return new Set(
    scored
      .sort((a, b) => a.score - b.score)
      .slice(0, count)
      .map((s) => s.id),
  );
}

/** A missing or partly covered concept the reviewer tagged as one the lesson leans on. */
export const isCoreGap = (gap: ContentGap) => gap.importance === "core";
