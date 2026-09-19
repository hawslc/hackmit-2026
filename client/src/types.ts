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
