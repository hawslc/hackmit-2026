// Turns the lecture material the client holds into the plain-text lesson plan
// ai-review's coverage reviewer reads.

import type { ReviewMaterial } from "@cadence/shared";

/** Returns undefined when there is nothing to grade against, so coverage is skipped. */
export function materialToLessonPlan(material: ReviewMaterial): string | undefined {
  const parts: string[] = [];

  const concepts = material.concepts.filter((c) => c.name.trim());
  if (concepts.length) {
    parts.push("Concepts to cover:");
    for (const c of concepts) {
      const importance = c.importance === undefined ? "" : ` (importance ${c.importance}/5)`;
      parts.push(`- ${c.name}${importance}`);
    }
  }

  const corpus = material.files
    .map((f) => f.text)
    .filter(Boolean)
    .join("\n\n");
  if (corpus) parts.push(`\nMaterials:\n${corpus}`);

  return parts.join("\n").trim() || undefined;
}
