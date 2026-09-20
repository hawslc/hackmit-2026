// One error shape for the whole API: every non-2xx returns JSON `{ error }`,
// (ApiErrorBody in @cadence/shared), which is what the client reads.

import type { ApiErrorBody } from "@cadence/shared";
import type { ErrorRequestHandler } from "express";
import { LlmError } from "ai-review";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

/** Map an LLM failure to a user-safe HttpError; anything else passes through untouched. */
export function llmErrorToHttp(err: unknown, failedMessage: string, timeoutMessage: string): unknown {
  if (!(err instanceof LlmError)) return err;
  switch (err.kind) {
    case "timeout":
      return new HttpError(504, timeoutMessage);
    case "not-configured":
      return new HttpError(500, "The server isn't configured for AI extraction.");
    default:
      return new HttpError(502, failedMessage);
  }
}

/** True for multer's own errors (e.g. file too large), which we surface as 400. */
function isMulterError(err: unknown): err is Error {
  return err instanceof Error && err.name === "MulterError";
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let message = "Something went wrong.";

  if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
  } else if (isMulterError(err)) {
    status = 400;
    message = err.message;
  } else if (err instanceof Error && err.message) {
    message = err.message;
  }

  if (status >= 500) console.error("[server] error:", err);
  const body: ApiErrorBody = { error: message };
  res.status(status).json(body);
};
