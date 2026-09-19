/**
 * Client <-> server contract. Everything that crosses the wire lives here.
 * Announce changes in the team chat before editing — this file breaks both
 * sides at compile time. See docs/design.md and docs/rubric.md.
 */

// ---------- Materials (setup) ----------

export const UPLOAD_LIMITS = {
  maxFiles: 5,
  maxFileBytes: 20 * 1024 * 1024,
  maxCharsPerFile: 60_000,
  acceptedExtensions: ['pptx', 'pdf', 'docx', 'txt', 'md'] as const,
};

export type FileFormat = (typeof UPLOAD_LIMITS.acceptedExtensions)[number];

export interface SourceFile {
  id: string;
  name: string;
  format: FileFormat;
  /** Extracted text; sections marked with markdown headings (`## Slide 3`). */
  text: string;
  charCount: number;
  /** True when text was cut off at UPLOAD_LIMITS.maxCharsPerFile. */
  truncated: boolean;
}

export type ConceptImportance = 'core' | 'supporting' | 'optional';

export interface Concept {
  id: string;
  label: string;
  importance: ConceptImportance;
  /** Where it came from, e.g. "week3.pptx · slide 7". */
  source: string;
}

export interface LectureMaterial {
  files: SourceFile[];
  concepts: Concept[];
}

// ---------- Practice session (live capture) ----------

/** A single transcribed word; start/end are seconds since session start. */
export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
}

/** A silence gap between consecutive words. */
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
  /** True when `words` timestamps were synthesized (Scribe's timestamped
   *  commit was lost) rather than measured. Pauses are unaffected — they're
   *  measured from the audio envelope, not word gaps. */
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

/** What the live pipeline produces when the TA clicks "Finish". */
export interface CompletedSession {
  transcript: string;
  words: TranscriptWord[];
  metrics: DeliveryMetrics;
  /** Browser-local recording for playback; never uploaded. */
  recording: Blob;
}

// ---------- Live-capture tuning constants (see docs/rubric.md) ----------

export const PAUSE_THRESHOLD_SEC = 1.5;
export const MAX_PAUSES_KEPT = 100;

export const FILLER_PHRASES = [
  'um',
  'uh',
  'like',
  'so',
  'basically',
  'actually',
  'you know',
  'i mean',
  'kind of',
  'sort of',
] as const;

export const SCORE_BANDS = {
  wpm: { good: [130, 160], zero: [80, 220] },
  fillersPerMin: { goodBelow: 3, zeroAt: 12 },
  pausesPerMin: { good: [0.5, 5], zeroAt: 10 },
  semitoneVariationFull: 3,
  rmsFullMark: 0.03,
} as const;

/** Rate metrics (fillers/min, pauses/min) are computed over at least this
 *  many seconds so early-session numbers don't swing wildly. */
export const MIN_RATE_WINDOW_SEC = 30;

export const SCORE_WEIGHTS = {
  pace: 0.3,
  pauses: 0.15,
  fillers: 0.25,
  intonation: 0.2,
  volume: 0.1,
} as const;

// ---------- Scribe token endpoint ----------

export interface ScribeTokenResponse {
  token: string;
}

// ---------- Review ----------

export interface ReviewRequest {
  /** Null when the TA uploaded no materials; content section reports skipped. */
  material: LectureMaterial | null;
  transcript: string;
  words: TranscriptWord[];
  metrics: DeliveryMetrics;
}

export type SectionResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'error'; error: string }
  | { status: 'skipped'; reason: string };

export interface SpeakingSection {
  score: SpeakingScore;
  tips: string[];
}

export type ConceptCoverage = 'covered' | 'partial' | 'missing';

export interface ConceptResult {
  concept: Concept;
  coverage: ConceptCoverage;
  /** Transcript quote evidencing the coverage call; null when missing. */
  quote: string | null;
  note: string;
}

export interface ContentSection {
  items: ConceptResult[];
}

export interface SkillScore {
  /** 1-5 per docs/rubric.md. */
  score: number;
  /** Transcript quote backing the score. */
  quote: string;
  note: string;
}

export interface TeachingSection {
  accessibleLanguage: SkillScore;
  analogiesExamples: SkillScore;
  checksForUnderstanding: SkillScore;
}

export interface SessionReview {
  speaking: SectionResult<SpeakingSection>;
  content: SectionResult<ContentSection>;
  teaching: SectionResult<TeachingSection>;
  summary: string;
  topPriority: string;
}
