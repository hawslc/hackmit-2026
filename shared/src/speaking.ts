// Live practice capture: delivery metrics + speaking score. Produced client-side
// during a session; the words also feed POST /api/review. See docs/rubric.md.

import type { WordTiming } from "./review.ts";

/** One transcribed word; start/end are seconds since session start. Alias of the
 *  review contract's `WordTiming` so both names refer to one shape. */
export type TranscriptWord = WordTiming;

/** A silence gap. `start` and `duration` in seconds. */
export interface Pause {
  start: number;
  duration: number;
}

export interface PitchSummary {
  meanHz: number;
  /** Stddev of the pitch track in semitones. ~0 = monotone. */
  variationSemitones: number;
}

export interface VolumeSummary {
  meanRms: number;
  /** Coefficient of variation (stddev / mean). ~0 = perfectly steady. */
  variation: number;
}

export interface DeliveryMetrics {
  durationSec: number;
  wordCount: number;
  wpm: number;
  pauseCount: number;
  totalPauseSec: number;
  /** Gaps >= PAUSE_THRESHOLD_SEC, capped at MAX_PAUSES_KEPT. */
  pauses: Pause[];
  fillerCount: number;
  fillersPerMin: number;
  /** Null when no usable pitch track was captured. */
  pitch: PitchSummary | null;
  /** Null when no usable volume track was captured. */
  volume: VolumeSummary | null;
  /** True when `words` timestamps were synthesized (Scribe's timestamped commit
   *  was lost) rather than measured. Pauses are unaffected — they're measured
   *  from the audio envelope, not word gaps. */
  timestampsSynthesized?: boolean;
}

export interface SpeakingScoreComponents {
  pace: number | null;
  pauses: number | null;
  fillers: number | null;
  intonation: number | null;
  volume: number | null;
}

/** 0-100. Component is null when its metric was unavailable; overall renormalizes. */
export interface SpeakingScore {
  overall: number;
  components: SpeakingScoreComponents;
}

// ---------- Tuning constants (see docs/rubric.md) ----------

export const PAUSE_THRESHOLD_SEC = 1.5;
export const MAX_PAUSES_KEPT = 100;

export const FILLER_PHRASES = [
  "um",
  "uh",
  "like",
  "so",
  "basically",
  "actually",
  "you know",
  "i mean",
  "kind of",
  "sort of",
] as const;

export const SCORE_BANDS = {
  wpm: { good: [130, 160], zero: [80, 220] },
  fillersPerMin: { goodBelow: 3, zeroAt: 12 },
  pausesPerMin: { good: [0.5, 5], zeroAt: 10 },
  semitoneVariationFull: 3,
  rmsFullMark: 0.03,
} as const;

/** Rate metrics (fillers/min, pauses/min) are computed over at least this many
 *  seconds so early-session numbers don't swing wildly. */
export const MIN_RATE_WINDOW_SEC = 30;

export const SCORE_WEIGHTS = {
  pace: 0.3,
  pauses: 0.15,
  fillers: 0.25,
  intonation: 0.2,
  volume: 0.1,
} as const;

// ---------- Scribe token endpoint ----------

/** Response of GET /api/scribe-token. */
export interface ScribeTokenResponse {
  token: string;
}
