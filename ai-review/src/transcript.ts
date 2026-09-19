// Pure helpers over a Scribe word-timing array. These derive the deterministic
// signals reviewers rely on (elapsed time, sentence segments, pauses, fillers)
// and format a timestamped transcript so the LLM can cite `[mm:ss]` moments.

import type { WordTiming } from "./types.ts";

export const LONG_PAUSE_SEC = 1.5;

/** Single-word fillers plus the one bigram we track. */
export const FILLER_WORDS = ["um", "uh", "like", "so", "basically", "actually", "you know"];

/** Reconstruct plain text from words. */
export function fullText(words: WordTiming[]): string {
  return words
    .map((w) => w.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+([.,!?;:])/g, "$1");
}

/** Seconds from the first word's start to the last word's end. */
export function elapsedSec(words: WordTiming[]): number {
  if (words.length === 0) return 0;
  const first = words[0]!;
  const last = words[words.length - 1]!;
  return Math.max(0, last.end - first.start);
}

export interface Segment {
  text: string;
  startSec: number;
  endSec: number;
}

/**
 * Group words into sentence-ish segments, breaking after terminal punctuation
 * (. ? !). A very long run with no punctuation is broken every `maxWords` so a
 * single rambling stretch still yields a citable segment.
 */
export function splitSentences(words: WordTiming[], maxWords = 40): Segment[] {
  const segments: Segment[] = [];
  let bucket: WordTiming[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    segments.push({
      text: fullText(bucket),
      startSec: bucket[0]!.start,
      endSec: bucket[bucket.length - 1]!.end,
    });
    bucket = [];
  };

  for (const w of words) {
    bucket.push(w);
    const endsSentence = /[.!?]$/.test(w.text.trim());
    if (endsSentence || bucket.length >= maxWords) flush();
  }
  flush();
  return segments;
}

/** `mm:ss` from seconds. */
export function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

/** One `[mm:ss] sentence` line per segment — the transcript we hand the LLM. */
export function formatTimestampedTranscript(words: WordTiming[]): string {
  return splitSentences(words)
    .map((seg) => `[${mmss(seg.startSec)}] ${seg.text}`)
    .join("\n");
}

export interface LongPause {
  atSec: number;
  durationSec: number;
}

/** Gaps between consecutive words longer than `threshold`. */
export function findLongPauses(words: WordTiming[], threshold = LONG_PAUSE_SEC): LongPause[] {
  const pauses: LongPause[] = [];
  for (let i = 1; i < words.length; i++) {
    const gap = words[i]!.start - words[i - 1]!.end;
    if (gap > threshold) pauses.push({ atSec: words[i - 1]!.end, durationSec: gap });
  }
  return pauses;
}

/** Whole-words-per-minute over the session. */
export function wordsPerMinute(words: WordTiming[]): number {
  const minutes = elapsedSec(words) / 60;
  if (minutes <= 0) return 0;
  return Math.round(words.length / minutes);
}

const normalize = (t: string): string => t.toLowerCase().replace(/[^a-z']/g, "");

/** Count filler occurrences (single words + the "you know" bigram). */
export function countFillers(words: WordTiming[]): number {
  const singles = new Set(FILLER_WORDS.filter((f) => !f.includes(" ")));
  const tokens = words.map((w) => normalize(w.text));
  let count = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (singles.has(tokens[i]!)) count++;
    if (tokens[i] === "you" && tokens[i + 1] === "know") count++;
  }
  return count;
}

/** Deterministic fillers-per-minute, rounded to one decimal. */
export function fillersPerMinute(words: WordTiming[]): number {
  const minutes = elapsedSec(words) / 60;
  if (minutes <= 0) return 0;
  return Math.round((countFillers(words) / minutes) * 10) / 10;
}

const words2 = (s: string): string[] => normalize2(s).split(" ").filter(Boolean);
const normalize2 = (s: string): string => s.toLowerCase().replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Resolve an LLM-returned quote to the start time of the segment it came from.
 * Prefers substring containment, then falls back to the segment sharing the most
 * words with the quote. Returns 0 when nothing matches (so the UI still has a number).
 */
export function locateQuoteSec(quote: string, segments: Segment[]): number {
  if (segments.length === 0) return 0;
  const q = normalize2(quote);
  if (q) {
    for (const seg of segments) {
      if (normalize2(seg.text).includes(q)) return seg.startSec;
    }
  }
  const qWords = new Set(words2(quote));
  let best: Segment | undefined;
  let bestOverlap = 0;
  for (const seg of segments) {
    let overlap = 0;
    for (const w of words2(seg.text)) if (qWords.has(w)) overlap++;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = seg;
    }
  }
  return best?.startSec ?? segments[0]!.startSec;
}
