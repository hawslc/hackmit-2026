/** Body of every non-2xx response. The client surfaces `error` to the user. */
export interface ApiErrorBody {
  error: string;
}

/** Response of GET /api/scribe-token: a single-use Scribe v2 Realtime token (expires ~15 min). */
export interface ScribeTokenResponse {
  token: string;
}

/** A reviewer either produced data, was deliberately skipped, or failed in isolation. */
export type SectionResult<T> =
  | { status: "ok"; data: T }
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string };
