import { toServerConcept } from "../types";
import type {
  CompletedSession,
  ContentGap,
  FactualIssue,
  LectureMaterial,
  SectionReview,
  SessionReview,
} from "../types";
import { errorMessage, jitter, sleep } from "./util";

// Same flag as api/materials.ts. Set VITE_USE_MOCK_API=false to hit the real API.
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== "false";

/** POST /api/review { material, transcript } → SessionReview. */
export async function requestReview(
  material: LectureMaterial,
  session: CompletedSession,
  signal?: AbortSignal,
): Promise<SessionReview> {
  if (USE_MOCK) return mockReview(material, session, signal);
  const res = await fetch("/api/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      material: { files: material.files, concepts: material.concepts.map(toServerConcept) },
      transcript: session.transcript,
    }),
    signal,
  });
  if (!res.ok) throw new Error(await errorMessage(res, "We couldn't review your session."));
  return (await res.json()) as SessionReview;
}

// ---- Mock mode -------------------------------------------------------------
// Handy triggers for demoing the failure states (matched against uploaded file names):
//   "fail-review" → the whole request fails
//   "fail-facts"  → the factual check errors inline
//   "no-facts"    → no factual issues (the block is hidden)
//   no concepts   → content gaps (and the Content section) are skipped

async function mockReview(
  material: LectureMaterial,
  _session: CompletedSession,
  signal?: AbortSignal,
): Promise<SessionReview> {
  await sleep(jitter(1500, 2500));
  signal?.throwIfAborted();
  const named = (marker: string) => material.files.some((f) => f.name.includes(marker));
  if (named("fail-review")) throw new Error("Mock review failure");

  const noContent = "Add materials or key concepts to get a content review.";
  const hasConcepts = material.concepts.length > 0;

  const speaking: SectionReview = {
    id: "speaking",
    score: 82,
    summary: "Clear and steady pace with a confident tone.",
    feedback: [
      { point: "A few filler words crept in when you moved between ideas.", quote: "so, um, basically the next thing is" },
    ],
  };
  const content: SectionReview = {
    id: "content",
    score: 64,
    summary: "You covered the main flow but skipped some key ideas.",
    feedback: [
      { point: "The core definition came late; leading with it would anchor students.", quote: "and that's kind of what Big-O is" },
      { point: "Try one worked example for each new idea." },
    ],
  };
  const teaching: SectionReview = {
    id: "teaching",
    score: 71,
    summary: "Good analogies, but check for understanding more often.",
    feedback: [
      { point: "You moved on without pausing for questions after the hardest step.", quote: "okay, everyone with me? great, moving on" },
    ],
  };

  return {
    summary: "A confident first pass. Your delivery was clear; the biggest gains are in covering the key ideas and checking that students follow.",
    topPriority: "Cover every core concept before moving on, and pause after the hardest step to check understanding.",
    sections: [
      { status: "ok", data: speaking },
      hasConcepts ? { status: "ok", data: content } : { status: "skipped", reason: noContent },
      { status: "ok", data: teaching },
    ],
    gaps: hasConcepts
      ? { status: "ok", data: mockGaps(material) }
      : { status: "skipped", reason: noContent },
    factualIssues: named("fail-facts")
      ? { status: "error", message: "We couldn't run the fact check this time." }
      : { status: "ok", data: named("no-facts") ? [] : [mockIssue(material)] },
  };
}

/** The first three concepts are flagged: missing, partial, missing. */
function mockGaps({ concepts }: LectureMaterial): ContentGap[] {
  return concepts.slice(0, 3).map((c, i) => ({
    concept: c.name,
    source: c.source,
    importance: c.importance,
    status: i === 1 ? "partial" : "missing",
  }));
}

function mockIssue({ files }: LectureMaterial): FactualIssue {
  const base = {
    quote: "So one plus two is four, which is why the loop runs again.",
    problem: "1 + 2 equals 3, not 4.",
    correction: "1 + 2 = 3",
  };
  return files.length
    ? {
        ...base,
        basis: "materials",
        source: {
          label: `${files[0].name} · slide 7`,
          excerpt: "Worked example: 1 + 2 = 3, so the loop runs a third time.",
        },
      }
    : {
        ...base,
        basis: "general",
        source: { label: "Wikipedia: Addition", url: "https://en.wikipedia.org/wiki/Addition" },
      };
}
