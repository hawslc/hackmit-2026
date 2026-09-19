// Upload limits, mirroring the client's UPLOAD_LIMITS (docs/design.md). Files
// beyond maxChars are truncated (not rejected) and flagged truncated:true.

export const LIMITS = {
  /** Max number of files per lecture (enforced client-side; per-request here is one file). */
  maxFiles: 5,
  /** Max bytes per uploaded file. */
  maxBytes: 20 * 1024 * 1024,
  /** Max characters of extracted text kept per file. */
  maxChars: 60_000,
} as const;
