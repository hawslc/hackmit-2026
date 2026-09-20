import type { WordTiming } from "@cadence/shared";

const DEFAULT_SEC_PER_WORD = 0.4;

/**
 * Evenly spaced word timings for a plain transcript. Stands in for Scribe's real
 * timestamps until live capture lands.
 */
export function wordsFromTranscript(transcript: string, secPerWord = DEFAULT_SEC_PER_WORD): WordTiming[] {
  return transcript
    .split(/\s+/)
    .filter(Boolean)
    .map((text, i) => ({ text, start: i * secPerWord, end: (i + 1) * secPerWord }));
}
