// Prompt scaffolding shared by every reviewer. The rubric-specific text lives
// next to each reviewer so a prompt can be tuned in one place. Reviewers resolve
// `atSec` from the returned quotes, so prompts ask only for quotes + judgments,
// never for computed timestamps.

export interface Prompt {
  system: string;
  user: string;
}

export const SHARED_RULES = `Rules for your response:
- Output a single JSON object and nothing else. No markdown, no prose outside the JSON.
- Every judgment must cite a short quote copied verbatim from the transcript.
- Keep the tone encouraging and specific, like a supportive mentor.`;

export const transcriptBlock = (t: string) =>
  `Transcript (each line is "[mm:ss] sentence"):\n"""\n${t}\n"""`;
