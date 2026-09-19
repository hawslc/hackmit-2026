// Load the repo-root .env once, regardless of the cwd npm ran the workspace
// script from (`npm -w server run dev` runs with cwd = server/). ai-review reads
// process.env afterwards, so loading it here also configures LLM_PROVIDER etc.

import { fileURLToPath } from "node:url";

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  try {
    // server/src/env.ts -> ../../.env is the repo root.
    process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
  } catch {
    /* no root .env — fine; ai-review defaults to mock mode */
  }
}

/** Port to listen on. Defaults to 3001 (the client's Vite dev proxy target). */
export function port(): number {
  const raw = process.env.PORT;
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : 3001;
}
