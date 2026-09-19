// Environment + resolved config. Read lazily so importing this module has no
// side effects (a backend can import `runReview` without a .env present).

import type { LlmProvider, ReviewOptions } from "./types.ts";

let envLoaded = false;

/** Load repo-local .env once, if present. No-op when the file is missing. */
function ensureEnvLoaded(): void {
  if (envLoaded) return;
  envLoaded = true;
  try {
    // Node >= 21.7 native loader. Missing file throws — we fall back to real env / mocks.
    process.loadEnvFile();
  } catch {
    /* no .env — that's fine, defaults to mock */
  }
}

export interface ResolvedConfig {
  provider: LlmProvider;
  model: string;
  apiKey: string | undefined;
  timeoutMs: number;
}

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 30_000;

/** Merge per-request options over env, with sensible defaults. */
export function resolveConfig(opts: ReviewOptions = {}): ResolvedConfig {
  ensureEnvLoaded();

  const rawProvider = (opts.provider ?? process.env.LLM_PROVIDER ?? "mock").toLowerCase();
  const provider: LlmProvider = rawProvider === "openai" ? "openai" : "mock";

  return {
    provider,
    model: opts.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
    apiKey: process.env.OPENAI_API_KEY,
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
}

export function isMock(cfg: ResolvedConfig): boolean {
  return cfg.provider === "mock";
}
