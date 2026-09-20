import type { CoachingCategory } from "@cadence/shared";

/** Category → display label. Coverage shows as "Content" in the UI. */
export const categoryLabel: Record<CoachingCategory, string> = {
  delivery: "Delivery",
  coverage: "Content",
  teaching: "Teaching",
  structure: "Structure",
  engagement: "Engagement",
  confidence: "Confidence",
};

export function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}
