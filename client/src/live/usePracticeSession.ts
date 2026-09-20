import {
  computeSpeakingScore,
  type DeliveryMetrics,
  type SpeakingScore,
} from '@ta-coach/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompletedSession } from '../types';
import { AudioFeatureSampler, type InstantAudio } from './audioFeatures';
import { MetricsAccumulator, synthesizeWords } from './metrics';
import { SessionRecorder } from './recorder';
import { ScribeRealtime } from './scribe';
import { useMicrophone } from './useMicrophone';

export type SessionPhase =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'stopping'
  | 'done'
  | 'error';

/** Live snapshot for the meters, refreshed ~2x/sec while recording. */
export interface LiveSnapshot {
  metrics: DeliveryMetrics;
  score: SpeakingScore;
  instant: InstantAudio;
  transcript: string;
  partial: string;
}

const LIVE_TICK_MS = 250;

/**
 * Orchestrates one practice session: "Start practice" fans one mic stream out
 * to Scribe (live transcript), the audio-feature sampler (pitch/volume) and
 * the recorder. "Finish" stops everything and returns a CompletedSession for
 * the review request.
 *
 * `start()` acquires the mic itself; pass an already-open stream (e.g. one the
 * setup screen opened) to reuse it — borrowed streams are not released here.
 */
export function usePracticeSession() {
  const [phase, setPhase] = useState<SessionPhase>('idle');
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [session, setSession] = useState<CompletedSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { acquire: acquireMic, release: releaseMic } = useMicrophone();
  const accumulatorRef = useRef<MetricsAccumulator | null>(null);
  const samplerRef = useRef<AudioFeatureSampler | null>(null);
  const recorderRef = useRef<SessionRecorder | null>(null);
  const scribeRef = useRef<ScribeRealtime | null>(null);
  const tickRef = useRef<number | null>(null);
  const partialRef = useRef('');
  const ownsStreamRef = useRef(false);
  // start() is async; a StrictMode remount or unmount mid-start bumps `gen` so
  // the stale attempt abandons itself instead of clobbering the live session.
  const genRef = useRef(0);
  const busyRef = useRef(false);

  const takeSnapshot = useCallback((): LiveSnapshot | null => {
    const acc = accumulatorRef.current;
    if (!acc) return null;
    const instant = samplerRef.current?.current ?? { pitchHz: null, rms: 0 };
    const { pitch, volume } = samplerRef.current?.summaries() ?? {
      pitch: null,
      volume: null,
    };
    const metrics = acc.snapshot(
      Date.now(),
      pitch,
      volume,
      samplerRef.current?.detectPauses(),
    );
    return {
      metrics,
      score: computeSpeakingScore(metrics),
      instant,
      transcript: acc.transcript,
      partial: partialRef.current,
    };
  }, []);

  const releaseStream = useCallback(() => {
    if (ownsStreamRef.current) releaseMic();
    ownsStreamRef.current = false;
  }, [releaseMic]);

  const start = useCallback(async (existingStream?: MediaStream) => {
    if (busyRef.current || phase === 'recording' || phase === 'stopping') {
      return;
    }
    busyRef.current = true;
    const gen = ++genRef.current;
    setError(null);
    setSession(null);
    setPhase('starting');
    // Pipeline pieces stay local until they're all live, so a stale attempt
    // (gen bumped by unmount/restart) cleans up only what it created.
    let sampler: AudioFeatureSampler | null = null;
    let recorder: SessionRecorder | null = null;
    let scribe: ScribeRealtime | null = null;
    let owns = !existingStream;
    const stale = () => genRef.current !== gen;
    try {
      // A provided stream can arrive dead — e.g. StrictMode's dev remount runs
      // the caller's cleanup, which stops its tracks. Reacquire in that case.
      // `owns` stays local so a superseding attempt can't flip our cleanup.
      let stream = existingStream;
      if (!stream?.getAudioTracks().some((t) => t.readyState === "live")) {
        owns = true;
        stream = await acquireMic();
      }
      if (stale()) {
        if (owns) releaseMic();
        return;
      }
      ownsStreamRef.current = owns;

      const accumulator = new MetricsAccumulator(Date.now());
      partialRef.current = '';

      sampler = new AudioFeatureSampler();
      sampler.start(stream);
      recorder = new SessionRecorder();
      recorder.start(stream);

      scribe = new ScribeRealtime();
      await scribe.connect(stream, {
        onPartial: (text) => {
          partialRef.current = text;
        },
        onCommitted: (text, words) => {
          accumulator.addCommitted(text, words);
          partialRef.current = '';
        },
        onError: (message) => setError(message),
      });
      if (stale()) return;

      accumulatorRef.current = accumulator;
      samplerRef.current = sampler;
      recorderRef.current = recorder;
      scribeRef.current = scribe;

      tickRef.current = window.setInterval(() => {
        setLive(takeSnapshot());
      }, LIVE_TICK_MS);
      setPhase('recording');
    } catch (e) {
      genRef.current++;
      if (tickRef.current != null) window.clearInterval(tickRef.current);
      await teardown(scribeRef, samplerRef, recorderRef, releaseStream);
      await scribe?.stop().catch(() => {});
      await sampler?.stop().catch(() => {});
      await recorder?.stop().catch(() => {});
      if (!stale()) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase('error');
      }
    } finally {
      busyRef.current = false;
      if (stale()) {
        // A newer start (or unmount) superseded this one: drop this attempt's
        // pieces without touching the refs the live session now owns.
        void scribe?.stop().catch(() => {});
        void sampler?.stop().catch(() => {});
        void recorder?.stop().catch(() => {});
        if (owns) releaseMic();
      }
    }
  }, [phase, acquireMic, releaseMic, takeSnapshot, releaseStream]);

  const finish = useCallback(async (): Promise<CompletedSession | null> => {
    if (phase !== 'recording') return null;
    setPhase('stopping');
    if (tickRef.current != null) window.clearInterval(tickRef.current);

    await scribeRef.current?.stop();
    const recording = (await recorderRef.current?.stop()) ?? new Blob();
    const audioSummary = samplerRef.current?.summaries() ?? {
      pitch: null,
      volume: null,
    };
    await samplerRef.current?.stop();
    releaseStream();

    const acc = accumulatorRef.current;
    if (!acc) {
      setPhase('error');
      return null;
    }
    if (acc.allWords.length === 0 && acc.transcript.trim()) {
      acc.addCommitted('', synthesizeWords(acc.transcript, acc.elapsedSec()));
      acc.markSynthesized();
    }
    const metrics = acc.snapshot(
      Date.now(),
      audioSummary.pitch,
      audioSummary.volume,
      samplerRef.current?.detectPauses(),
    );
    const completed: CompletedSession = {
      transcript: acc.transcript,
      words: acc.allWords,
      durationSec: metrics.durationSec,
      metrics,
      recording,
    };
    setSession(completed);
    setLive(null);
    setPhase('done');
    return completed;
  }, [phase, releaseStream]);

  useEffect(
    () => () => {
      genRef.current++;
      busyRef.current = false;
      if (tickRef.current != null) window.clearInterval(tickRef.current);
      void teardown(scribeRef, samplerRef, recorderRef, releaseStream);
    },
    [releaseStream],
  );

  return { phase, live, session, error, start, finish };
}

async function teardown(
  scribeRef: React.MutableRefObject<ScribeRealtime | null>,
  samplerRef: React.MutableRefObject<AudioFeatureSampler | null>,
  recorderRef: React.MutableRefObject<SessionRecorder | null>,
  releaseMic: () => void,
): Promise<void> {
  await scribeRef.current?.stop().catch(() => {});
  scribeRef.current = null;
  await samplerRef.current?.stop().catch(() => {});
  samplerRef.current = null;
  await recorderRef.current?.stop().catch(() => {});
  recorderRef.current = null;
  releaseMic();
}
