// Client-only types. What crosses the wire lives in `@cadence/shared`; this file
// holds what the UI adds on top of it (concept origin, the session handed from
// Practice to Review).

import type { Concept as WireConcept, DeliveryMetrics, SourceFile, WordTiming } from "@cadence/shared";

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
