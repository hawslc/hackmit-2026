// Canned reviewer outputs for LLM_PROVIDER=mock. Themed around a recursion
// lesson so the demo report reads coherently against the sample transcript.
// This is both the offline dev path and the demo fallback.

import type {
  ConfidenceReview,
  CoverageReview,
  DeliveryReview,
  EngagementReview,
  ExtractedConcept,
  StructureReview,
  TeachingReview,
} from "./types.ts";

// Canned concept list for LLM_PROVIDER=mock. Themed around the recursion lesson
// so the offline Setup screen populates coherent chips without any API key.
export const mockConcepts: ExtractedConcept[] = [
  { name: "Base case", importance: 5, source: "recursion.pptx · slide 3" },
  { name: "Recursive case", importance: 5, source: "recursion.pptx · slide 4" },
  { name: "The call stack", importance: 3, source: "recursion.pptx · slide 6" },
  { name: "Infinite recursion / stack overflow", importance: 3, source: "notes.md · Pitfalls" },
  { name: "Factorial as a worked example", importance: 2, source: "recursion.pptx · slide 5" },
];

export const mockDelivery: DeliveryReview = {
  note: "Mostly clear and to the point — a couple of spots run long and could be tightened.",
  moments: [
    {
      quote:
        "So recursion is basically when a function, like, calls itself, and it keeps calling itself over and over until, you know, eventually it stops at some point",
      atSec: 12,
      issue: "rambling",
      suggestion: "Tighten to: \"Recursion is when a function calls itself until it hits a stopping condition.\"",
    },
    {
      quote: "the base case is the case that is the base, the one that doesn't recurse",
      atSec: 41,
      issue: "verbose",
      suggestion: "Say it once: \"The base case is the stopping condition — it doesn't call the function again.\"",
    },
  ],
};

export const mockCoverage: CoverageReview = {
  coveredCount: 3,
  totalCount: 4,
  concepts: [
    {
      name: "Base case",
      importance: "core",
      status: "covered",
      evidence: "every recursion needs a base case, otherwise it never stops",
      note: "Clearly introduced and motivated.",
    },
    {
      name: "Recursive case",
      importance: "core",
      status: "covered",
      evidence: "the function calls itself on a smaller input",
      note: "Covered with the factorial example.",
    },
    {
      name: "The call stack",
      importance: "supporting",
      status: "partial",
      evidence: "each call waits for the next one to finish",
      note: "Mentioned in passing — a quick diagram of stacked calls would land it.",
    },
    {
      name: "Infinite recursion / stack overflow",
      importance: "supporting",
      status: "missing",
      evidence: "",
      note: "Fine to skip for an intro, but a one-line warning about forgetting the base case would help.",
    },
  ],
};

export const mockTeaching: TeachingReview = {
  scores: [
    {
      category: "accessible_language",
      score: 4,
      strength: "You defined \"base case\" in plain words before using it.",
      suggestion: "Watch the stacked terms in one breath — introduce \"stack frame\" on its own.",
      evidence: "the base case is the stopping condition, the simplest version of the problem",
    },
    {
      category: "analogies_examples",
      score: 4,
      strength: "Factorial was a great concrete worked example before the general rule.",
      suggestion: "Add a second everyday analogy (e.g. Russian nesting dolls) for the structure.",
      evidence: "let's compute factorial of 3 step by step",
    },
    {
      category: "checks_for_understanding",
      score: 2,
      strength: "You did pause to invite a question near the end.",
      suggestion: "Swap \"Does that make sense?\" for an open prompt like \"What would happen if we removed the base case?\"",
      evidence: "does that make sense to everyone?",
    },
  ],
};

export const mockStructure: StructureReview = {
  note: "Good arc overall: definition, example, then a close — one transition was abrupt.",
  issues: [
    {
      problem: "Jumps from the definition straight into factorial without saying why we start there.",
      suggestion: "Add a one-line bridge: \"Let's see this with the simplest example — factorial.\"",
      quote: "okay so let's compute factorial of 3",
      atSec: 58,
    },
  ],
};

export const mockEngagement: EngagementReview = {
  note: "Warm and approachable; mostly one-directional, with one nice invitation to think.",
  observations: [
    {
      quote: "what do you think happens if the function never reaches the base case?",
      atSec: 96,
      note: "Open question that invites prediction — great engagement moment.",
    },
    {
      quote: "so we just keep going and going and going through each number",
      atSec: 70,
      note: "A longer flat stretch — a quick call-and-response here would lift energy.",
    },
  ],
};

export const mockConfidence: ConfidenceReview = {
  note: "Confident overall; a few hedges and fillers early on that are easy to trim.",
  fillersPerMinute: 4.2,
  instances: [
    { quote: "recursion is basically when a function, like, calls itself", atSec: 12, type: "filler" },
    { quote: "I think maybe the easiest way to see it is an example", atSec: 30, type: "hedge" },
    { quote: "so, um, the base case", atSec: 41, type: "filler" },
  ],
};

export const mockSynthesis = {
  summary:
    "A clear, friendly intro to recursion: you defined the base case well and used factorial as a solid worked example. The main opportunity is checking for understanding — you mostly asked \"does that make sense?\" rather than making students predict or reason.",
  topPriority:
    "Replace closed checks (\"make sense?\") with one open question that forces prediction, e.g. \"What happens if we remove the base case?\"",
};
