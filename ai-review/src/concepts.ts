// Concept extraction: step 0, run at upload rather than at review. Turns the
// uploaded lecture files into the concept checklist the coverage reviewer grades
// against. Kept here so all LLM logic — and the mock path — lives in one module.

import type { Concept, ExtractConceptsRequest } from "@ta-coach/shared";
import { completeJson } from "./llm/client.ts";
import { isMock, resolveConfig } from "./llm/config.ts";
import type { Prompt } from "./llm/prompt.ts";
import type { ReviewOptions } from "./types.ts";

type MaterialFiles = ExtractConceptsRequest["files"];

// ---- Prompt ---------------------------------------------------------------

function prompt(files: MaterialFiles): Prompt {
  const corpus = files
    .map((f) => `### File: ${f.name}\n${f.text}`)
    .join("\n\n");
  return {
    system: `You extract the key concepts a teacher must get across, from their uploaded lecture materials.
Read all the files and produce ONE deduplicated list: the same idea appearing on a slide and in the notes is a single concept.
Aim for 5–12 concepts — the ideas that matter, not every bullet point.
For each concept:
- "name": a short noun phrase (e.g. "Base case", "Big-O notation"), not a full sentence.
- "importance": an integer 1–5 for how essential it is (5 = the lesson doesn't work without it, 1 = a nice-to-have aside).
- "source": where it comes from, using the file name and the nearest markdown heading in that file, formatted like "week3.pptx · slide 7" or "notes.md · Overview". Omit if you can't tell.

Return JSON: {
  "concepts": [
    { "name": string, "importance": 1 | 2 | 3 | 4 | 5, "source": string }
  ]
}
Output only the JSON object. No prose outside it.`,
    user: `Materials:\n"""\n${corpus}\n"""`,
  };
}

// ---- Mock (LLM_PROVIDER=mock) ---------------------------------------------
// Themed around the recursion lesson so the offline Setup screen populates coherent chips.

const mockConcepts: Concept[] = [
  { name: "Base case", importance: 5, source: "recursion.pptx · slide 3" },
  { name: "Recursive case", importance: 5, source: "recursion.pptx · slide 4" },
  { name: "The call stack", importance: 3, source: "recursion.pptx · slide 6" },
  { name: "Infinite recursion / stack overflow", importance: 3, source: "notes.md · Pitfalls" },
  { name: "Factorial as a worked example", importance: 2, source: "recursion.pptx · slide 5" },
];

// ---- Extraction -----------------------------------------------------------

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
  files: MaterialFiles,
  opts: ReviewOptions = {},
): Promise<Concept[]> {
  const cfg = resolveConfig(opts);
  if (isMock(cfg)) return mockConcepts;

  const { system, user } = prompt(files);
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
