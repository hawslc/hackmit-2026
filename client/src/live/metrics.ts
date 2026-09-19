import {
  FILLER_PHRASES,
  MAX_PAUSES_KEPT,
  MIN_RATE_WINDOW_SEC,
  PAUSE_THRESHOLD_SEC,
  type DeliveryMetrics,
  type Pause,
  type PitchSummary,
  type TranscriptWord,
  type VolumeSummary,
} from '@hackmit/shared';

const FILLER_REGEX = new RegExp(
  `\\b(${FILLER_PHRASES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'gi',
);

/**
 * Accumulates committed transcript words over a session and produces a
 * DeliveryMetrics snapshot on demand — cheap enough to call every ~500ms
 * for the live meters, and once more at "Finish" for the final numbers.
 */
export class MetricsAccumulator {
  private words: TranscriptWord[] = [];
  private committedText = '';
  private synthesized = false;
  private readonly startedAtMs: number;

  constructor(startedAtMs = Date.now()) {
    this.startedAtMs = startedAtMs;
  }

  addCommitted(text: string, words: TranscriptWord[]): void {
    this.committedText += (this.committedText && text ? ' ' : '') + text;
    this.words.push(...words);
    this.words.sort((a, b) => a.start - b.start);
  }

  get transcript(): string {
    return this.committedText;
  }

  get allWords(): TranscriptWord[] {
    return this.words;
  }

  elapsedSec(nowMs = Date.now()): number {
    return Math.max(0, (nowMs - this.startedAtMs) / 1000);
  }

  markSynthesized(): void {
    this.synthesized = true;
  }

  /**
   * acousticPauses comes from the RMS envelope (silence detection) and is
   * preferred; when absent, pauses fall back to gaps between word timestamps.
   */
  snapshot(
    nowMs = Date.now(),
    pitch: PitchSummary | null = null,
    volume: VolumeSummary | null = null,
    acousticPauses?: Pause[],
  ): DeliveryMetrics {
    const durationSec = Math.max(0, (nowMs - this.startedAtMs) / 1000);
    const minutes = durationSec / 60;
    const rateMinutes = Math.max(durationSec, MIN_RATE_WINDOW_SEC) / 60;
    const pauses = acousticPauses
      ? {
          count: acousticPauses.length,
          totalSec: acousticPauses.reduce((s, p) => s + p.duration, 0),
          list: acousticPauses,
        }
      : findPauses(this.words);
    const fillerCount = countFillers(this.committedText);
    return {
      durationSec: round1(durationSec),
      wordCount: this.words.length,
      wpm: minutes > 0 ? round1(this.words.length / minutes) : 0,
      pauseCount: pauses.count,
      totalPauseSec: round1(pauses.totalSec),
      pauses: pauses.list,
      timestampsSynthesized: this.synthesized || undefined,
      fillerCount,
      fillersPerMin: round1(fillerCount / rateMinutes),
      pitch,
      volume,
    };
  }
}

export function countFillers(text: string): number {
  const matches = text.match(FILLER_REGEX);
  return matches ? matches.length : 0;
}

/**
 * Last resort when Scribe returned transcript text but no word timestamps
 * (e.g. the final commit was lost): spread words evenly over the session so
 * WPM still works. Pauses/intonation stay unaffected.
 */
export function synthesizeWords(
  transcript: string,
  durationSec: number,
): TranscriptWord[] {
  const texts = transcript.trim().split(/\s+/).filter(Boolean);
  if (texts.length === 0 || durationSec <= 0) return [];
  const slot = durationSec / texts.length;
  return texts.map((text, i) => ({
    text,
    start: i * slot,
    end: Math.min(i * slot + 0.4, (i + 1) * slot),
  }));
}

function findPauses(words: TranscriptWord[]): { count: number; totalSec: number; list: Pause[] } {
  let count = 0;
  let totalSec = 0;
  const list: Pause[] = [];
  for (let i = 1; i < words.length; i++) {
    const gap = words[i]!.start - words[i - 1]!.end;
    if (gap >= PAUSE_THRESHOLD_SEC) {
      count++;
      totalSec += gap;
      if (list.length < MAX_PAUSES_KEPT) {
        list.push({ start: round1(words[i - 1]!.end), duration: round1(gap) });
      }
    }
  }
  return { count, totalSec, list };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
