// Reads the finished sections and produces { summary, topPriority }. Never
// throws: on any LLM failure it falls back to a deterministic priority using the
// rubric's preference order (missing core > lowest teaching score > delivery/structure).

import type { SectionResult, SessionReview } from "@ta-coach/shared";
import { completeJson } from "./llm/client.ts";
import { isMock, type ResolvedConfig } from "./llm/config.ts";
import type { Prompt } from "./llm/prompt.ts";

/** The sections produced before synthesis. */
export type Sections = Omit<SessionReview, "summary" | "topPriority">;

interface Synthesis {
  summary: string;
  topPriority: string;
}

// ---- Prompt ---------------------------------------------------------------

function prompt(digest: string): Prompt {
  return {
    system: `You are the lead mentor. Several specialist reviewers have assessed a teaching-practice session; their notes are below.
Write a short, encouraging summary (2–3 sentences) of how it went, then pick ONE top priority to work on next.
Priority preference order: a missing CORE concept > the lowest teaching-skill score > the most impactful delivery or structure issue.
Make the top priority concrete and actionable.

Return JSON: { "summary": string, "topPriority": string }
Output only the JSON object.`,
    user: `Reviewer notes:\n${digest}`,
  };
}

// ---- Mock (LLM_PROVIDER=mock) ---------------------------------------------

const mockSynthesis: Synthesis = {
  summary:
    "A clear, friendly intro to recursion: you defined the base case well and used factorial as a solid worked example. The main opportunity is checking for understanding — you mostly asked \"does that make sense?\" rather than making students predict or reason.",
  topPriority:
    "Replace closed checks (\"make sense?\") with one open question that forces prediction, e.g. \"What happens if we remove the base case?\"",
};

// ---- Synthesis ------------------------------------------------------------

const data = <T>(s: SectionResult<T>): T | undefined => (s.status === "ok" ? s.data : undefined);

const TEACHING_LABELS: Record<string, string> = {
  accessible_language: "accessible language",
  analogies_examples: "analogies & examples",
  checks_for_understanding: "checks for understanding",
};

/** Compact text summary of the ok sections, for the synthesizer prompt. */
function buildDigest(s: Sections): string {
  const lines: string[] = [];

  const cov = data(s.coverage);
  if (cov) {
    const missingCore = cov.concepts.filter((c) => c.status === "missing" && c.importance === "core");
    lines.push(`Coverage: ${cov.coveredCount}/${cov.totalCount} concepts covered.`);
    if (missingCore.length) lines.push(`  Missing CORE: ${missingCore.map((c) => c.name).join(", ")}.`);
  } else if (s.coverage.status === "skipped") {
    lines.push("Coverage: skipped (no lesson plan).");
  }

  const teach = data(s.teaching);
  if (teach) {
    lines.push(
      `Teaching scores: ${teach.scores.map((t) => `${TEACHING_LABELS[t.category] ?? t.category} ${t.score}/5`).join(", ")}.`,
    );
  }

  const del = data(s.delivery);
  if (del) lines.push(`Delivery (clarity/conciseness): ${del.moments.length} moment(s) flagged. ${del.note}`);

  const str = data(s.structure);
  if (str) lines.push(`Structure: ${str.issues.length} issue(s). ${str.note}`);

  const eng = data(s.engagement);
  if (eng) lines.push(`Engagement: ${eng.note}`);

  const conf = data(s.confidence);
  if (conf) lines.push(`Confidence: ${conf.fillersPerMinute} fillers/min. ${conf.note}`);

  return lines.join("\n");
}

/** Deterministic priority following the rubric's preference order. */
function fallback(s: Sections): Synthesis {
  const cov = data(s.coverage);
  const missingCore = cov?.concepts.find((c) => c.status === "missing" && c.importance === "core");
  if (missingCore) {
    return {
      summary: "Nice work practicing. The clearest next step is a core idea that didn't make it in.",
      topPriority: `Make sure to cover "${missingCore.name}" — it's a core concept and the lesson leans on it.`,
    };
  }

  const teach = data(s.teaching);
  const lowest = teach?.scores.slice().sort((a, b) => a.score - b.score)[0];
  if (lowest && lowest.score <= 3) {
    return {
      summary: "A solid session overall — one teaching skill stands out as the biggest opportunity.",
      topPriority: `Focus on ${TEACHING_LABELS[lowest.category] ?? lowest.category} (scored ${lowest.score}/5). ${lowest.suggestion}`,
    };
  }

  const del = data(s.delivery);
  if (del && del.moments.length) {
    return {
      summary: "Strong content — tightening a few phrasings will make it land even better.",
      topPriority: `Tighten your wording: ${del.moments[0]!.suggestion}`,
    };
  }

  const str = data(s.structure);
  if (str && str.issues.length) {
    return {
      summary: "Good session — a small structural tweak would sharpen the flow.",
      topPriority: str.issues[0]!.suggestion,
    };
  }

  return {
    summary: "Great job — this was a clear, well-organized session with no major gaps.",
    topPriority: "Keep practicing to lock in the delivery; try it once more at a natural pace.",
  };
}

export async function synthesize(s: Sections, cfg: ResolvedConfig): Promise<Synthesis> {
  if (isMock(cfg)) return mockSynthesis;

  try {
    const { system, user } = prompt(buildDigest(s));
    const raw = await completeJson<Partial<Synthesis>>({ task: "synthesize", system, user }, cfg);
    if (raw.summary && raw.topPriority) {
      return { summary: raw.summary, topPriority: raw.topPriority };
    }
    return fallback(s);
  } catch {
    return fallback(s);
  }
}
