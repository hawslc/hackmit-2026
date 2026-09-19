// One error shape for the whole API: every non-2xx returns JSON `{ error }`,
// which is exactly what the client reads (client/src/api/materials.ts).

import type { ErrorRequestHandler } from "express";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
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
  res.status(status).json({ error: message });
};
