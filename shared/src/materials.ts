// Lecture materials: POST /api/materials/file and POST /api/materials/concepts.

/** A lecture file after the server has extracted its text (response of POST /api/materials/file). */
export interface SourceFile {
  name: string;
  /** Extracted text, markdown-headed (`## Slide 3`) so reviewers can cite sources. */
  text: string;
  size: number;
  /** Set by the server when text was cut at `UPLOAD_LIMITS.maxChars`. */
  truncated?: boolean;
}

/** One idea students should walk away with. */
export interface Concept {
  name: string;
  /** Where it came from, e.g. `week3.pptx · slide 7`. Absent for user-added concepts. */
  source?: string;
  /** 1 (nice to have) to 5 (essential). Absent for user-added concepts. */
  importance?: number;
}

/** Body of POST /api/materials/concepts. Only `name` and `text` are read. */
export interface ExtractConceptsRequest {
  files: Pick<SourceFile, "name" | "text">[];
}

/** Response of POST /api/materials/concepts: one deduplicated list across all files. */
export type ExtractConceptsResponse = Concept[];

/** The lecture material a review is graded against. */
export interface ReviewMaterial {
  files: Pick<SourceFile, "name" | "text">[];
  concepts: Concept[];
}
