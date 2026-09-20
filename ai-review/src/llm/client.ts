// The single LLM choke point. Every reviewer's real path calls `completeJson`.
// OpenAI client is built lazily so importing this module is side-effect free.
// Logs go to stderr to keep the demo's stdout report clean.

import OpenAI from "openai";
import type { ResolvedConfig } from "./config.ts";

/** How an LLM call failed, so the server can map it to an HTTP status. */
export type LlmErrorKind = "timeout" | "not-configured" | "failed";

/** A user-safe LLM failure. The raw provider error is logged to stderr, never put in `message`. */
export class LlmError extends Error {
  kind: LlmErrorKind;
  constructor(kind: LlmErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "LlmError";
  }
}

let client: OpenAI | null = null;

/** Test seam: inject a fake client (or null to reset). */
export function setClientForTesting(c: OpenAI | null): void {
  client = c;
}

function getClient(cfg: ResolvedConfig): OpenAI {
  if (client) return client;
  if (!cfg.apiKey) {
    throw new LlmError("not-configured", "OPENAI_API_KEY is not set (required when LLM_PROVIDER=openai)");
  }
  // maxRetries: 0 — retrying is ours (below), so the SDK's own retries don't stack with it.
  client = new OpenAI({ apiKey: cfg.apiKey, maxRetries: 0 });
  return client;
}

export interface CompleteJsonArgs {
  /** Short label for logs, e.g. "delivery-review". */
  task: string;
  system: string;
  user: string;
  /** When set, use strict Structured Outputs with this JSON schema instead of plain `json_object`. */
  schema?: { name: string; schema: object };
  /** Per-request timeout in ms. Defaults to `cfg.timeoutMs`. */
  timeoutMs?: number;
}

/** Worth a second attempt: bad JSON, rate limiting, or a server-side error. Never a timeout or other 4xx. */
function isRetryable(err: unknown): boolean {
  if (err instanceof OpenAI.APIConnectionTimeoutError) return false;
  if (err instanceof OpenAI.APIError && err.status !== undefined) {
    return err.status === 429 || err.status >= 500;
  }
  return true; // JSON parse errors and network drops
}

/**
 * Ask the model for a JSON object and parse it. Retries once on bad JSON, 429,
 * 5xx or a dropped connection; never after a timeout or an auth/bad-request
 * error. Throws an `LlmError`. The orchestrator wraps this in its own timeout
 * and turns a throw into a contained `{status:"error"}` section.
 */
export async function completeJson<T>(args: CompleteJsonArgs, cfg: ResolvedConfig): Promise<T> {
  const openai = getClient(cfg);
  const started = Date.now();
  const timeout = args.timeoutMs ?? cfg.timeoutMs;
  const response_format = args.schema
    ? {
        type: "json_schema" as const,
        json_schema: { name: args.schema.name, strict: true, schema: args.schema.schema as Record<string, unknown> },
      }
    : { type: "json_object" as const };

  let lastErr: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await openai.chat.completions.create(
        {
          model: cfg.model,
          temperature: 0.2,
          response_format,
          messages: [
            { role: "system", content: args.system },
            { role: "user", content: args.user },
          ],
        },
        { timeout },
      );
      const content = res.choices[0]?.message?.content ?? "";
      const parsed = JSON.parse(content) as T;
      console.error(`[llm] ${args.task} ok in ${Date.now() - started}ms (attempt ${attempt})`);
      return parsed;
    } catch (err) {
      lastErr = err;
      console.error(`[llm] ${args.task} attempt ${attempt} failed: ${(err as Error).message}`);
      if (!isRetryable(err)) break;
    }
  }

  if (lastErr instanceof OpenAI.APIConnectionTimeoutError) {
    throw new LlmError("timeout", `${args.task} timed out after ${timeout}ms`);
  }
  throw new LlmError("failed", `${args.task} failed: the model call did not succeed`);
}
