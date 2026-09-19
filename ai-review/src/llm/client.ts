// The single LLM choke point. Every reviewer's real path calls `completeJson`.
// OpenAI client is built lazily so importing this module is side-effect free.
// Logs go to stderr to keep the demo's stdout report clean.

import OpenAI from "openai";
import type { ResolvedConfig } from "./config.ts";

let client: OpenAI | null = null;

function getClient(cfg: ResolvedConfig): OpenAI {
  if (!cfg.apiKey) {
    throw new Error("OPENAI_API_KEY is not set (required when LLM_PROVIDER=openai)");
  }
  if (!client) client = new OpenAI({ apiKey: cfg.apiKey });
  return client;
}

export interface CompleteJsonArgs {
  /** Short label for logs, e.g. "delivery-review". */
  task: string;
  system: string;
  user: string;
}

/**
 * Ask the model for a JSON object and parse it. Retries once on a parse/API
 * failure, then throws with the task name. The caller (orchestrator) wraps this
 * in a timeout and turns a throw into a contained `{status:"error"}` section.
 */
export async function completeJson<T>(args: CompleteJsonArgs, cfg: ResolvedConfig): Promise<T> {
  const openai = getClient(cfg);
  const started = Date.now();
  let lastErr: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await openai.chat.completions.create({
        model: cfg.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
      });
      const content = res.choices[0]?.message?.content ?? "";
      const parsed = JSON.parse(content) as T;
      console.error(`[llm] ${args.task} ok in ${Date.now() - started}ms (attempt ${attempt})`);
      return parsed;
    } catch (err) {
      lastErr = err;
      console.error(`[llm] ${args.task} attempt ${attempt} failed: ${(err as Error).message}`);
    }
  }

  throw new Error(`${args.task} failed after 2 attempts: ${(lastErr as Error)?.message ?? lastErr}`);
}
