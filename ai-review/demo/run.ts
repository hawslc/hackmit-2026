// CLI demo: run the review on a transcript JSON (+ optional lesson plan) and
// pretty-print the report.
//
//   npm run demo -- demo/sample-transcript.json demo/sample-lesson-plan.md
//   npm run demo -- demo/sample-transcript.json          (coverage skipped)
//
// LLM_PROVIDER=mock (default) runs offline. Set LLM_PROVIDER=openai + OPENAI_API_KEY
// in .env to use the real model.

import { readFileSync } from "node:fs";
import { runReview } from "../src/index.ts";
import { mmss } from "../src/transcript.ts";
import type { SectionResult, WordTiming } from "../src/types.ts";

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

/** Print a section header, then either its body, a skip reason, or an error. */
function section<T>(title: string, result: SectionResult<T>, body: (data: T) => void): void {
  console.log(H(title));
  if (result.status === "skipped") console.log(`  (skipped — ${result.reason})`);
  else if (result.status === "error") console.log(`  \x1b[31m! error: ${result.error}\x1b[0m`);
  else body(result.data);
}

const review = await runReview({ words, lessonPlan });

console.log(H("═══ TA COACH — SESSION REVIEW ═══"));
console.log(`\n${review.summary}`);
console.log(`\n\x1b[1m➤ Top priority:\x1b[0m ${review.topPriority}`);

section("Delivery — clarity & conciseness", review.delivery, (d) => {
  console.log(`  ${d.note}`);
  for (const m of d.moments) {
    console.log(`  • ${at(m.atSec)} (${m.issue}) ${quote(m.quote)}`);
    console.log(`      → ${m.suggestion}`);
  }
  if (d.moments.length === 0) console.log("  • No clarity issues flagged. 🎉");
});

section("Scope — lesson-plan coverage", review.coverage, (c) => {
  console.log(`  Covered ${c.coveredCount} of ${c.totalCount} concepts. You don't need to hit everything.`);
  for (const concept of c.concepts) {
    const tag = concept.status === "covered" ? "✓" : concept.status === "partial" ? "~" : "✗";
    console.log(`  ${tag} ${concept.name} (${concept.importance}, ${concept.status})`);
    if (concept.note) console.log(`      ${concept.note}`);
    if (concept.evidence) console.log(`      evidence: ${quote(concept.evidence)}`);
  }
});

section("Teaching skills", review.teaching, (t) => {
  for (const s of t.scores) {
    console.log(`  ${s.category}: \x1b[1m${s.score}/5\x1b[0m`);
    console.log(`      + ${s.strength}`);
    console.log(`      → ${s.suggestion}`);
    if (s.evidence) console.log(`      evidence: ${quote(s.evidence)}`);
  }
});

section("Clarity & structure", review.structure, (s) => {
  console.log(`  ${s.note}`);
  for (const i of s.issues) {
    console.log(`  • ${i.problem}`);
    if (i.quote && i.atSec !== undefined) console.log(`      ${at(i.atSec)} ${quote(i.quote)}`);
    console.log(`      → ${i.suggestion}`);
  }
});

section("Engagement", review.engagement, (e) => {
  console.log(`  ${e.note}`);
  for (const o of e.observations) console.log(`  • ${at(o.atSec)} ${o.note} ${quote(o.quote)}`);
});

section("Confidence & filler", review.confidence, (c) => {
  console.log(`  ${c.note}`);
  console.log(`  Fillers per minute: \x1b[1m${c.fillersPerMinute}\x1b[0m`);
  for (const i of c.instances) console.log(`  • ${at(i.atSec)} (${i.type}) ${quote(i.quote)}`);
});

console.log("");
