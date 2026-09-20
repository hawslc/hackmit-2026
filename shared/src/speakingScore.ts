import {
  MIN_RATE_WINDOW_SEC,
  SCORE_BANDS,
  SCORE_WEIGHTS,
  type DeliveryMetrics,
  type SpeakingScore,
} from "./live.ts";

/**
 * Deterministic speaking score (0-100) from measured delivery metrics.
 * Used by the live meter during practice and by the review pipeline after
 * "Finish" — same function both places, per docs/rubric.md.
 */
export function computeSpeakingScore(m: DeliveryMetrics): SpeakingScore {
  const pace = scoreBand(m.wpm, SCORE_BANDS.wpm.good[0], SCORE_BANDS.wpm.good[1],
    SCORE_BANDS.wpm.zero[0], SCORE_BANDS.wpm.zero[1]);

  const fillers = clamp100(
    ((SCORE_BANDS.fillersPerMin.zeroAt - m.fillersPerMin) /
      (SCORE_BANDS.fillersPerMin.zeroAt - SCORE_BANDS.fillersPerMin.goodBelow)) * 100,
  );

  const pauses = scorePauses(m);
  const intonation = m.pitch == null
    ? null
    : clamp100((m.pitch.variationSemitones / SCORE_BANDS.semitoneVariationFull) * 100);
  const volume = scoreVolume(m);

  const components = { pace, pauses, fillers, intonation, volume };
  const weights = {
    pace: SCORE_WEIGHTS.pace,
    pauses: SCORE_WEIGHTS.pauses,
    fillers: SCORE_WEIGHTS.fillers,
    intonation: SCORE_WEIGHTS.intonation,
    volume: SCORE_WEIGHTS.volume,
  };

  let sum = 0;
  let weightSum = 0;
  for (const key of Object.keys(components) as (keyof typeof components)[]) {
    const value = components[key];
    if (value != null) {
      sum += value * weights[key];
      weightSum += weights[key];
    }
  }

  return {
    overall: weightSum === 0 ? 0 : Math.round(sum / weightSum),
    components: mapRound(components),
  };
}

function scorePauses(m: DeliveryMetrics): number | null {
  if (m.durationSec < 15) return null;
  const ppm = m.pauseCount / (Math.max(m.durationSec, MIN_RATE_WINDOW_SEC) / 60);
  const [goodLo, goodHi] = SCORE_BANDS.pausesPerMin.good;
  if (ppm >= goodLo && ppm <= goodHi) return 100;
  if (ppm < goodLo) return 50 + (ppm / goodLo) * 50; // never pauses: mildly penalized
  return clamp100(((SCORE_BANDS.pausesPerMin.zeroAt - ppm) /
    (SCORE_BANDS.pausesPerMin.zeroAt - goodHi)) * 100);
}

function scoreVolume(m: DeliveryMetrics): number | null {
  if (m.volume == null) return null;
  const loudness = clamp100((m.volume.meanRms / SCORE_BANDS.rmsFullMark) * 100);
  const steadiness = clamp100((1 - m.volume.variation) * 100);
  return Math.round(loudness * 0.5 + steadiness * 0.5);
}

function scoreBand(v: number, goodLo: number, goodHi: number, zeroLo: number, zeroHi: number): number {
  if (v >= goodLo && v <= goodHi) return 100;
  if (v < goodLo) return clamp100(((v - zeroLo) / (goodLo - zeroLo)) * 100);
  return clamp100(((zeroHi - v) / (zeroHi - goodHi)) * 100);
}

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function mapRound<T extends Record<string, number | null>>(c: T): T {
  const out = { ...c };
  for (const k of Object.keys(out) as (keyof T)[]) {
    const v = out[k];
    if (typeof v === 'number') out[k] = Math.round(v) as T[keyof T];
  }
  return out;
}
