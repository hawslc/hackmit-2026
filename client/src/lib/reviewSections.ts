import type { ContentGap, SectionId, SectionResult, SectionReview } from "../types";

// TODO: replace with the sections defined by the backend once it's merged.
// Placeholder sections from docs/rubric.md; everything that names them lives here.
export const SECTIONS: { id: SectionId; title: string }[] = [
  { id: "speaking", title: "Speaking" },
  { id: "content", title: "Content" },
  { id: "teaching", title: "Teaching" },
];

export const sectionTitle = (id: SectionId) => SECTIONS.find((s) => s.id === id)?.title ?? id;

// The server returns `sections` in SECTIONS order, so a failed/skipped entry (which carries no id)
// is titled by its position.
export const titleAt = (index: number) => SECTIONS[index]?.title ?? "Section";

/** Ids of the `count` lowest-scoring sections. Errored/skipped sections aren't ranked. */
export function pickHighlighted(results: SectionResult<SectionReview>[], count: number): Set<SectionId> {
  const ok = results.flatMap((r) => (r.status === "ok" ? [r.data] : []));
  const order = (id: SectionId) => SECTIONS.findIndex((s) => s.id === id);
  return new Set(
    [...ok]
      .sort((a, b) => a.score - b.score || order(a.id) - order(b.id))
      .slice(0, count)
      .map((s) => s.id),
  );
}

// TODO: reconcile with the rubric's `core / supporting / optional` tags.
/** User-added concepts (no importance) count as core: the TA said students must learn them. */
export const isCoreGap = (gap: ContentGap) => gap.importance === undefined || gap.importance >= 4;
