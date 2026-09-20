// Review: POST /api/review. The response is a small set of grounded coaching
// cards. Every card traces to a real moment in the session; `atSec` lets the UI
// label (and later seek to) that moment.

/** One word from Scribe's `committed_transcript_with_timestamps`. Times in seconds from session start. */
export interface WordTiming {
  text: string;
  start: number;
  end: number;
}

import type { ReviewMaterial } from "./materials.ts";

/** Body of POST /api/review. */
export interface ReviewRequestBody {
  words: WordTiming[];
  /** When absent (or without any text or concepts), the coverage reviewer is skipped. */
  material?: ReviewMaterial;
}

/** Importance/status kept for the coverage reviewer's internal concept checklist. */
export type ConceptImportance = "core" | "supporting" | "optional";
export type CoverageStatus = "covered" | "partial" | "missing";

/** Which reviewer surfaced a card — used only for the card's label. */
export type CoachingCategory =
  | "delivery"
  | "coverage"
  | "teaching"
  | "structure"
  | "engagement"
  | "confidence";

/** One grounded, actionable coaching item. */
export interface CoachingCard {
  category: CoachingCategory;
  /** 2–4 word title, e.g. "Stronger questions". */
  headline: string;
  /** Verbatim transcript quote, validated server-side. Empty only for plan-grounded coverage gaps. */
  quote: string;
  /** Seconds from session start of the quoted moment (0 for plan-grounded gaps). */
  atSec: number;
  /** Neutral description of what happened. */
  whatHappened: string;
  /** One sentence on why it matters. */
  whyItMatters: string;
  /** A concrete line the user could say next time. */
  tryInstead: string;
  /** The retry target carried into the next practice session. */
  practiceGoal: string;
}

/** Response of POST /api/review. */
export interface SessionReview {
  /** "insufficient" → nothing cleared the evidence bar; the UI shows a single honest line. */
  evidenceState: "coached" | "insufficient";
  /** The one main thing to work on; null when insufficient. */
  focus: CoachingCard | null;
  /** Additional grounded cards for progressive disclosure (0..3). */
  more: CoachingCard[];
}
