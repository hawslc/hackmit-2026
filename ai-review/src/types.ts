// Contracts for the AI review section.
//
// The module consumes an 11labs (ElevenLabs Scribe) transcript — words with
// timestamps — plus an optional lesson plan, and returns one structured review.
// Every quote-bearing judgment carries `atSec` so the UI can seek the recording
// to that moment later.

/** One word from Scribe's `committed_transcript_with_timestamps`. Times in seconds from session start. */
export interface WordTiming {
  text: string;
  start: number;
  end: number;
}

/** Input to `runReview`. `transcript` is derived from `words` when omitted. */
export interface ReviewRequest {
  words: WordTiming[];
  transcript?: string;
  /** Raw lesson-plan / materials text. When absent, the coverage section is skipped. */
  lessonPlan?: string;
}

/** Per-request overrides; fall back to env. Lets a backend control model/timeout per call. */
export interface ReviewOptions {
  provider?: LlmProvider;
  model?: string;
  /** Per-reviewer timeout in ms (default 30000). */
  timeoutMs?: number;
}

export type LlmProvider = "mock" | "openai";

// ---- Concept extraction (step 0, run at upload) ----

/** One uploaded lecture file after text extraction, handed to `extractConcepts`. */
export interface MaterialFile {
  name: string;
  /** Extracted text, markdown-headed (`## Slide 3`) so concepts can cite a source. */
  text: string;
}

/**
 * One idea students should walk away with, extracted from the materials.
 * Mirrors the client's `Omit<Concept,"origin">`: numeric importance 1–5.
 */
export interface ExtractedConcept {
  name: string;
  /** Where it came from, e.g. `week3.pptx · slide 7`. */
  source?: string;
  /** 1 (nice to have) to 5 (essential). */
  importance?: number;
}

/** A reviewer either produced data, was deliberately skipped, or failed in isolation. */
export type SectionResult<T> =
  | { status: "ok"; data: T }
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string };

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

/** The whole report. */
export interface SessionReview {
  summary: string;
  topPriority: string;
  delivery: SectionResult<DeliveryReview>;
  coverage: SectionResult<CoverageReview>;
  teaching: SectionResult<TeachingReview>;
  structure: SectionResult<StructureReview>;
  engagement: SectionResult<EngagementReview>;
  confidence: SectionResult<ConfidenceReview>;
}
