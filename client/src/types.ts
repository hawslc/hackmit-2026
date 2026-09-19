// TODO: replace with `shared/src/index.ts` once it exists. Names mirror docs/design.md.
// Announce any change to these shapes in the team chat; they are the client/server contract.

/** A lecture file after the server has extracted its text (POST /api/materials/file). */
export interface SourceFile {
  name: string;
  /** Extracted text, markdown-headed (`## Slide 3`) so reviewers can cite sources. */
  text: string;
  size: number;
  /** Set by the server when text was cut at UPLOAD_LIMITS.maxChars. */
  truncated?: boolean;
}

/** One idea students should walk away with. */
export interface Concept {
  name: string;
  /** Where it came from, e.g. `week3.pptx · slide 7`. Absent for user-added concepts. */
  source?: string;
  /** 1 (nice to have) to 5 (essential). Absent for user-added concepts. */
  importance?: number;
  /** Client-only. Stripped before anything is sent to the server. */
  origin: "extracted" | "user";
}

export interface LectureMaterial {
  files: SourceFile[];
  concepts: Concept[];
}

/** TODO: reconcile with the AI owner. The server should accept a Concept with just a name. */
export function toServerConcept({ origin: _origin, ...rest }: Concept): Omit<Concept, "origin"> {
  return rest;
}

// ---- Review ----------------------------------------------------------------
// TODO: replace with `shared` types once the server/AI owner's contract is merged.

/** What Practice hands to Review on Finish. */
export interface CompletedSession {
  transcript: string;
  durationSec: number;
  // TODO(live): + words, metrics, recording
}

// TODO(backend sections): replace with the sections defined by the backend once it's merged.
export type SectionId = "speaking" | "content" | "teaching";

/** Each part of a review can succeed, fail or be skipped on its own ("failures stay contained"). */
export type SectionResult<T> =
  | { status: "ok"; data: T }
  | { status: "error"; message: string }
  | { status: "skipped"; reason: string };

export interface SectionReview {
  id: SectionId;
  /** 0-100 */
  score: number;
  summary: string;
  feedback: { point: string; quote?: string }[];
}

export interface ContentGap {
  concept: string;
  source?: string;
  importance?: number;
  status: "missing" | "partial";
}

export interface FactualIssue {
  quote: string;
  problem: string;
  correction: string;
  basis: "materials" | "general";
  /** What the LLM used to judge the statement wrong. Only `http(s)` urls are rendered as links. */
  source: { label: string; excerpt?: string; url?: string };
}

export interface SessionReview {
  summary: string;
  topPriority: string;
  sections: SectionResult<SectionReview>[];
  gaps: SectionResult<ContentGap[]>;
  factualIssues: SectionResult<FactualIssue[]>;
}
