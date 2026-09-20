// CLI demo: run the review on a transcript JSON (+ optional lesson plan) and
// pretty-print the coaching cards.
//
//   npm run demo -- demo/sample-transcript.json demo/sample-lesson-plan.md
//   npm run demo -- demo/sample-transcript.json          (coverage skipped)
//
// LLM_PROVIDER=mock (default) runs offline. Set LLM_PROVIDER=openai + OPENAI_API_KEY
// in .env to use the real model.

import { readFileSync } from "node:fs";
import type { CoachingCard, WordTiming } from "@cadence/shared";
import { runReview } from "../src/index.ts";
import { mmss } from "../src/transcript.ts";

const [transcriptPath, lessonPlanPath] = process.argv.slice(2);

if (!transcriptPath) {
  console.error("Usage: npm run demo -- <transcript.json> [lessonPlan.(md|txt)]");
  process.exit(1);
}

const words = JSON.parse(readFileSync(transcriptPath, "utf8")) as WordTiming[];
const lessonPlan = lessonPlanPath ? readFileSync(lessonPlanPath, "utf8") : undefined;

const H = (s: string) => `\n\x1b[1m${s}\x1b[0m`;
const at = (sec: number) => `\x1b[2m[${mmss(sec)}]\x1b[0m`;
const quote = (q: string) => `\x1b[2m"${q}"\x1b[0m`;

function card(c: CoachingCard): void {
  console.log(`  \x1b[1m${c.headline}\x1b[0m  \x1b[2m(${c.category})\x1b[0m`);
  if (c.quote) console.log(`    ${at(c.atSec)} ${quote(c.quote)}`);
  console.log(`    What: ${c.whatHappened}`);
  console.log(`    Why:  ${c.whyItMatters}`);
  console.log(`    Try:  ${c.tryInstead}`);
  console.log(`    Goal: ${c.practiceGoal}`);
}

const review = await runReview({ words, lessonPlan });

console.log(H("═══ CADENCE — SESSION REVIEW ═══"));

if (review.evidenceState === "insufficient" || !review.focus) {
  console.log("\n  Not enough to evaluate yet — record a longer segment.\n");
} else {
  console.log(H("➤ Focus"));
  card(review.focus);
  if (review.more.length) {
    console.log(H("More"));
    for (const c of review.more) card(c);
  }
  console.log("");
}
