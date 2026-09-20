import {
  MAX_PAUSES_KEPT,
  PAUSE_THRESHOLD_SEC,
  type Pause,
  type PitchSummary,
  type VolumeSummary,
} from '@ta-coach/shared';

export interface InstantAudio {
  pitchHz: number | null;
  rms: number;
}

const SAMPLE_INTERVAL_MS = 50;
const MIN_RMS_FOR_PITCH = 0.01;
const MIN_RMS_FOR_SAMPLE = 0.005;
/** Silence threshold = max(this floor, 3x the 20th-percentile RMS). */
const PAUSE_RMS_FLOOR = 0.006;
const MIN_PITCH_HZ = 50;
const MAX_PITCH_HZ = 500;
const MIN_CORRELATION = 0.3;

/**
 * Taps a MediaStream with Web Audio and samples pitch (autocorrelation) and
 * volume (RMS). Samples below the noise floor are ignored so silence doesn't
 * drag down the summaries.
 */
export class AudioFeatureSampler {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private buf = new Float32Array(0);
  private timer: number | null = null;

  private pitchSamples: number[] = [];
  private rmsSamples: number[] = [];
  /** Every RMS sample with its session-relative time — the silence detector
   *  behind pause detection, kept separate from the voiced-only stats. */
  private envelope: { tMs: number; rms: number }[] = [];

  current: InstantAudio = { pitchHz: null, rms: 0 };

  start(stream: MediaStream): void {
    this.ctx = new AudioContext();
    const source = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.timer = window.setInterval(() => this.sample(), SAMPLE_INTERVAL_MS);
  }

  private sample(): void {
    if (!this.analyser || !this.ctx) return;
    this.analyser.getFloatTimeDomainData(this.buf);
    const rms = rmsOf(this.buf);
    const pitchHz = detectPitch(this.buf, this.ctx.sampleRate);
    this.current = { pitchHz, rms };
    this.envelope.push({ tMs: this.ctx.currentTime * 1000, rms });
    if (rms >= MIN_RMS_FOR_SAMPLE) {
      this.rmsSamples.push(rms);
      if (pitchHz != null) this.pitchSamples.push(pitchHz);
    }
  }

  summaries(): { pitch: PitchSummary | null; volume: VolumeSummary | null } {
    // Autocorrelation occasionally returns octave errors; drop samples more
    // than an octave from the median before summarizing.
    const medianHz = this.pitchSamples.length ? median(this.pitchSamples) : 0;
    const stable = this.pitchSamples.filter(
      (hz) => hz >= medianHz / 2 && hz <= medianHz * 2,
    );
    const pitch =
      stable.length >= 5
        ? {
            meanHz: mean(stable),
            variationSemitones: semitoneStddev(stable),
          }
        : null;
    const volume =
      this.rmsSamples.length >= 5
        ? {
            meanRms: mean(this.rmsSamples),
            variation: mean(this.rmsSamples) > 0
              ? stddev(this.rmsSamples) / mean(this.rmsSamples)
              : 0,
          }
        : null;
    return { pitch, volume };
  }

  /**
   * Silence runs >= minDurationSec, bounded by voiced audio on both sides —
   * so leading silence before the first word and trailing silence before
   * "Finish" don't count. Independent of Scribe word timestamps.
   */
  detectPauses(minDurationSec = PAUSE_THRESHOLD_SEC): Pause[] {
    if (this.envelope.length < 4) return [];
    const sorted = this.envelope.map((e) => e.rms).sort((a, b) => a - b);
    const noiseFloor = sorted[Math.floor(sorted.length * 0.2)] ?? 0;
    const threshold = Math.max(PAUSE_RMS_FLOOR, noiseFloor * 3);

    const pauses: Pause[] = [];
    let runStartMs: number | null = null;
    let seenVoiced = false;
    for (const { tMs, rms } of this.envelope) {
      if (rms < threshold) {
        if (runStartMs == null) runStartMs = tMs;
      } else {
        if (runStartMs != null && seenVoiced) {
          const duration = (tMs - runStartMs) / 1000;
          if (duration >= minDurationSec && pauses.length < MAX_PAUSES_KEPT) {
            pauses.push({
              start: Math.round(runStartMs) / 1000,
              duration: Math.round(duration * 10) / 10,
            });
          }
        }
        runStartMs = null;
        seenVoiced = true;
      }
    }
    return pauses;
  }

  async stop(): Promise<void> {
    if (this.timer != null) window.clearInterval(this.timer);
    this.timer = null;
    this.analyser = null;
    await this.ctx?.close();
    this.ctx = null;
    this.current = { pitchHz: null, rms: 0 };
  }
}

/** Normalized autocorrelation pitch detection, 50-500 Hz voice range. */
export function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  const rms = rmsOf(buf);
  if (rms < MIN_RMS_FOR_PITCH) return null;

  const minLag = Math.floor(sampleRate / MAX_PITCH_HZ);
  const maxLag = Math.min(Math.floor(sampleRate / MIN_PITCH_HZ), buf.length - 1);
  const energy = rms * rms;

  let bestLag = -1;
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < buf.length; i++) sum += buf[i]! * buf[i + lag]!;
    const corr = sum / ((buf.length - lag) * energy);
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestCorr < MIN_CORRELATION) return null;
  return sampleRate / bestLag;
}

function rmsOf(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
  return Math.sqrt(sum / buf.length);
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stddev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))));
}

function semitoneStddev(hzSamples: number[]): number {
  const semitones = hzSamples.map((hz) => 12 * Math.log2(hz));
  return stddev(semitones);
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}
