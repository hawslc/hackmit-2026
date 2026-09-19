// Concept extraction: step 0, run at upload rather than at review. Turns the
// uploaded lecture files into the concept checklist the coverage reviewer grades
// against. Kept here so all LLM logic — and the mock path — lives in one module.

import { isMock, resolveConfig } from "./env.ts";
import { completeJson } from "./llm.ts";
import { mockConcepts } from "./mock.ts";
import { conceptsPrompt } from "./prompts.ts";
import type { ExtractedConcept, MaterialFile, ReviewOptions } from "./types.ts";

interface RawConcept {
  name?: string;
  source?: string;
  importance?: number;
}
interface RawConcepts {
  concepts?: RawConcept[];
}

/** Clamp a model-supplied importance to the integer 1–5 the client expects. */
function asImportance(n: number | undefined): number | undefined {
  if (typeof n !== "number" || Number.isNaN(n)) return undefined;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/**
 * Extract one deduplicated concept list across all files. Mock mode returns a
 * canned list (no API key); the real path calls the shared LLM choke point.
 */
export async function extractConcepts(
  files: MaterialFile[],
  opts: ReviewOptions = {},
): Promise<ExtractedConcept[]> {
  const cfg = resolveConfig(opts);
  if (isMock(cfg)) return mockConcepts;

  const { system, user } = conceptsPrompt(files);
  const raw = await completeJson<RawConcepts>(
    { task: "concept-extraction", system, user },
    cfg,
  );

  return (raw.concepts ?? [])
    .filter((c): c is RawConcept & { name: string } => Boolean(c?.name?.trim()))
    .map((c) => ({
      name: c.name.trim(),
      source: c.source?.trim() || undefined,
      importance: asImportance(c.importance),
    }));
}
