/** Extensions the server can read. Legacy formats (.ppt, .doc, …) are rejected with an export hint. */
export const ACCEPTED_EXTENSIONS = [".pptx", ".pdf", ".docx", ".txt", ".md"] as const;

export const UPLOAD_LIMITS = {
  /** Max files per lecture. Enforced by the client; the server takes one file per request. */
  maxFiles: 5,
  /** Max bytes per uploaded file. */
  maxBytes: 20 * 1024 * 1024,
  /** Max characters of extracted text kept per file. Longer files are truncated, not rejected. */
  maxChars: 60_000,
} as const;
