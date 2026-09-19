// Review: POST /api/review. Every quote-bearing judgment carries `atSec` so the
// UI can seek the recording to that moment.

import type { ReviewMaterial } from "./materials.ts";
import type { SectionResult } from "./api.ts";

/** One word from Scribe's `committed_transcript_with_timestamps`. Times in seconds from session start. */
export interface WordTiming {
  text: string;
  start: number;
  end: number;
}

/** Body of POST /api/review. */
export interface ReviewRequestBody {
  words: WordTiming[];
  /** When absent (or without any text or concepts), the coverage section is skipped. */
  material?: ReviewMaterial;
}

// ---- Per-reviewer outputs ----

export type DeliveryIssue = "rambling" | "verbose" | "unclear";

export interface DeliveryMoment {
  quote: string;
  atSec: number;
  issue: DeliveryIssue;
  suggestion: string;
}

export interface DeliveryReview {
  /** Encouraging one-liner on overall clarity & conciseness. */
  note: string;
  moments: DeliveryMoment[];
}

export type ConceptImportance = "core" | "supporting" | "optional";
export type CoverageStatus = "covered" | "partial" | "missing";

export interface ConceptCoverage {
  name: string;
  importance: ConceptImportance;
  status: CoverageStatus;
  /** Transcript quote proving coverage; present when covered/partial. */
  evidence?: string;
  note?: string;
}

export interface CoverageReview {
  coveredCount: number;
  totalCount: number;
  concepts: ConceptCoverage[];
}

export type TeachingCategory =
  | "accessible_language"
  | "analogies_examples"
  | "checks_for_understanding";

export interface TeachingScore {
  category: TeachingCategory;
  /** 1–5. */
  score: number;
  strength: string;
  suggestion: string;
  evidence?: string;
}

export interface TeachingReview {
  scores: TeachingScore[];
}

export interface StructureIssue {
  problem: string;
  suggestion: string;
  quote?: string;
  atSec?: number;
}

export interface StructureReview {
  note: string;
  issues: StructureIssue[];
}

export interface EngagementObservation {
  quote: string;
  atSec: number;
  /** What this moment shows — e.g. "open question", "flat stretch". */
  note: string;
}

export interface EngagementReview {
  note: string;
  observations: EngagementObservation[];
}

export type ConfidenceInstanceType = "hedge" | "filler";

export interface ConfidenceInstance {
  quote: string;
  atSec: number;
  type: ConfidenceInstanceType;
}

export interface ConfidenceReview {
  note: string;
  /** Filler words per minute, derived deterministically from timestamps. */
  fillersPerMinute: number;
  instances: ConfidenceInstance[];
}

export interface FactualIssue {
  quote: string;
  problem: string;
  correction: string;
  basis: "materials" | "general";
  /** What the LLM used to judge the statement wrong. Only `http(s)` urls should be rendered as links. */
  source: { label: string; excerpt?: string; url?: string };
}

/** Response of POST /api/review: the whole report. */
export interface SessionReview {
  summary: string;
  topPriority: string;
  delivery: SectionResult<DeliveryReview>;
  coverage: SectionResult<CoverageReview>;
  teaching: SectionResult<TeachingReview>;
  structure: SectionResult<StructureReview>;
  engagement: SectionResult<EngagementReview>;
  confidence: SectionResult<ConfidenceReview>;
  /** TODO(ai): no reviewer produces this yet. The client renders it when present. */
  factualIssues?: SectionResult<FactualIssue[]>;
}
