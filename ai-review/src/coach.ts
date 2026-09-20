// Reads the grounded observation pool, ranks it, and produces the coaching cards
// the client renders. One LLM pass writes the prose; every non-prose field (quote,
// atSec, category) is carried straight from the source observation, so the coach
// cannot invent evidence. Never throws: on any LLM failure it falls back to a
// deterministic card built from the top observation.

import type { CoachingCard, CoachingCategory, SessionReview } from "@cadence/shared";
import { completeJson } from "./llm/client.ts";
import { isMock, type ResolvedConfig } from "./llm/config.ts";
import type { Observation } from "./types.ts";

const MORE_CAP = 3;

/** Lower rank = higher priority. */
const RANK: Record<CoachingCategory, number> = {
  coverage: 0,
  teaching: 1,
  structure: 2,
  engagement: 3,
  delivery: 4,
  confidence: 5,
};

const DEFAULT_HEADLINE: Record<CoachingCategory, string> = {
  coverage: "Cover a key idea",
  teaching: "Sharpen a teaching move",
  structure: "Smooth the structure",
  engagement: "Lift engagement",
  delivery: "Tighten your wording",
  confidence: "Project more confidence",
};

const DEFAULT_TRY = "Run this moment again with a small, deliberate change.";
const DEFAULT_GOAL = "Re-explain this part and apply the change above.";

/** Priority order, stable within a category (keeps the reviewer's own ordering). */
export function rankObservations(observations: Observation[]): Observation[] {
  return observations
    .map((o, i) => ({ o, i }))
    .sort((a, b) => RANK[a.o.category] - RANK[b.o.category] || a.i - b.i)
    .map((x) => x.o);
}

interface RawCard {
  headline?: string;
  whatHappened?: string;
  whyItMatters?: string;
  tryInstead?: string;
  practiceGoal?: string;
}

function buildCard(o: Observation, p: RawCard | undefined): CoachingCard {
  return {
    category: o.category,
    quote: o.quote,
    atSec: o.atSec,
    headline: p?.headline?.trim() || DEFAULT_HEADLINE[o.category],
    whatHappened: p?.whatHappened?.trim() || o.observation,
    whyItMatters: p?.whyItMatters?.trim() || o.whyItMatters,
    tryInstead: p?.tryInstead?.trim() || o.suggestion || DEFAULT_TRY,
    practiceGoal: p?.practiceGoal?.trim() || DEFAULT_GOAL,
  };
}

function assemble(selected: Observation[], prose: (RawCard | undefined)[]): SessionReview {
  const cards = selected.map((o, i) => buildCard(o, prose[i]));
  return { evidenceState: "coached", focus: cards[0]!, more: cards.slice(1) };
}

function coachPrompt(selected: Observation[]): { system: string; user: string } {
  const numbered = selected
    .map(
      (o, i) =>
        `${i + 1}. [${o.category}] "${o.quote}" — ${o.observation} Why: ${o.whyItMatters}${
          o.suggestion ? ` (seed: ${o.suggestion})` : ""
        }`,
    )
    .join("\n");
  return {
    system: `You are the lead mentor. You are given a ranked list of grounded observations from a teaching-practice session; #1 is the most important.
Turn each observation into a coaching card, in the SAME order. Do not introduce any claim not present in the observations. Do not invent or alter quotes.
For each card produce:
- headline: 2–4 words naming the skill
- whatHappened: one neutral sentence
- whyItMatters: one sentence
- tryInstead: a concrete line the teacher could actually say next time
- practiceGoal: a one-sentence retry target
Return a single JSON object and nothing else: { "cards": [ { "headline", "whatHappened", "whyItMatters", "tryInstead", "practiceGoal" } ] } — one card per observation, same order.`,
    user: `Observations (ranked):\n${numbered}`,
  };
}

export async function coach(observations: Observation[], cfg: ResolvedConfig): Promise<SessionReview> {
  const selected = rankObservations(observations).slice(0, 1 + MORE_CAP);
  if (selected.length === 0) return { evidenceState: "insufficient", focus: null, more: [] };

  if (isMock(cfg)) return assemble(selected, selected.map(() => undefined));

  try {
    const { system, user } = coachPrompt(selected);
    const raw = await completeJson<{ cards?: RawCard[] }>({ task: "coach", system, user }, cfg);
    return assemble(selected, selected.map((_, i) => raw.cards?.[i]));
  } catch {
    return assemble(selected, selected.map(() => undefined));
  }
}
