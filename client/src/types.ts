// Client-only types. What crosses the wire lives in `@ta-coach/shared`; this file
// holds what the UI adds on top of it (concept origin, the session handed from
// Practice to Review) and the review view model the Review screen renders.

import type {
  Concept as WireConcept,
  ConceptImportance,
  CoverageStatus,
  DeliveryMetrics,
  FactualIssue,
  SectionResult,
  SourceFile,
  WordTiming,
} from "@ta-coach/shared";

// ---- Materials -------------------------------------------------------------

export type ConceptOrigin = "extracted" | "user";

/** A wire concept plus where the UI got it from. `origin` never goes over the wire. */
export interface Concept extends WireConcept {
  origin: ConceptOrigin;
}

export interface LectureMaterial {
  files: SourceFile[];
  concepts: Concept[];
}

// ---- Practice → Review -----------------------------------------------------

/** What Practice hands to Review on Finish. */
export interface CompletedSession {
  /** Word-level timings from live transcription: what the review is built from. */
  words: WordTiming[];
  durationSec: number;
  /** Full committed transcript text. */
  transcript: string;
  /** Measured delivery metrics (WPM, pauses, fillers, pitch, volume). */
  metrics: DeliveryMetrics;
  /** Browser-local recording for playback on Review; never uploaded. */
  recording: Blob;
}

// ---- Review view model -----------------------------------------------------
// The server returns one section per reviewer (see `SessionReview`); the Review
// screen renders them through this shape. `toReviewView` does the mapping.

export type SectionId = "delivery" | "content" | "teaching" | "structure" | "engagement" | "confidence";

export interface SectionFeedback {
  point: string;
  quote?: string;
}

export interface SectionDetail {
  /** 0-100. Only sections with something measurable have one (content, teaching). */
  score?: number;
  summary: string;
  feedback: SectionFeedback[];
}

/** Each part of a review can succeed, fail or be skipped on its own ("failures stay contained"). */
export interface ReviewSection {
  id: SectionId;
  title: string;
  result: SectionResult<SectionDetail>;
}

export interface ContentGap {
  concept: string;
  importance: ConceptImportance;
  status: Exclude<CoverageStatus, "covered">;
  note?: string;
}

export interface ReviewView {
  summary: string;
  topPriority: string;
  sections: ReviewSection[];
  gaps: SectionResult<ContentGap[]>;
  factualIssues: SectionResult<FactualIssue[]>;
}
