/** Body of every non-2xx response. The client surfaces `error` to the user. */
export interface ApiErrorBody {
  error: string;
}

/** A reviewer either produced data, was deliberately skipped, or failed in isolation. */
export type SectionResult<T> =
  | { status: "ok"; data: T }
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string };
