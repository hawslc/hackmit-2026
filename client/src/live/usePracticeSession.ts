import { computeSpeakingScore } from '@hackmit/shared/speakingScore';
import type {
  CompletedSession,
  DeliveryMetrics,
  SpeakingScore,
} from '@hackmit/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
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
 * Orchestrates one practice session: "Start practice" acquires the mic once
 * and fans the stream out to Scribe (live transcript), the audio-feature
 * sampler (pitch/volume) and the recorder. "Finish" stops everything and
 * returns a CompletedSession for the review request.
 */
export function usePracticeSession() {
  const [phase, setPhase] = useState<SessionPhase>('idle');
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [session, setSession] = useState<CompletedSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mic = useMicrophone();
  const accumulatorRef = useRef<MetricsAccumulator | null>(null);
  const samplerRef = useRef<AudioFeatureSampler | null>(null);
  const recorderRef = useRef<SessionRecorder | null>(null);
  const scribeRef = useRef<ScribeRealtime | null>(null);
  const tickRef = useRef<number | null>(null);
  const partialRef = useRef('');

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

  const start = useCallback(async () => {
    if (phase === 'starting' || phase === 'recording' || phase === 'stopping') {
      return;
    }
    setError(null);
    setSession(null);
    setPhase('starting');
    try {
      const stream = await mic.acquire();

      const accumulator = new MetricsAccumulator(Date.now());
      accumulatorRef.current = accumulator;
      partialRef.current = '';

      const sampler = new AudioFeatureSampler();
      sampler.start(stream);
      samplerRef.current = sampler;

      const recorder = new SessionRecorder();
      recorder.start(stream);
      recorderRef.current = recorder;

      const scribe = new ScribeRealtime();
      scribeRef.current = scribe;
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

      tickRef.current = window.setInterval(() => {
        setLive(takeSnapshot());
      }, LIVE_TICK_MS);
      setPhase('recording');
    } catch (e) {
      await teardown(scribeRef, samplerRef, recorderRef, mic.release);
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  }, [phase, mic, takeSnapshot]);

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
    mic.release();

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
      metrics,
      recording,
    };
    setSession(completed);
    setLive(null);
    setPhase('done');
    return completed;
  }, [phase, mic]);

  useEffect(
    () => () => {
      if (tickRef.current != null) window.clearInterval(tickRef.current);
      void teardown(scribeRef, samplerRef, recorderRef, () => {});
    },
    [],
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
