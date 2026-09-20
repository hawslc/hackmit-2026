import {
  computeSpeakingScore,
  type DeliveryMetrics,
  type SpeakingScore,
} from "@cadence/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CompletedSession } from "../types";
import { AudioFeatureSampler, type InstantAudio } from "./audioFeatures";
import { MetricsAccumulator, synthesizeWords } from "./metrics";
import { SessionRecorder } from "./recorder";
import { ScribeRealtime } from "./scribe";

export type SessionPhase =
  | "idle"
  | "starting"
  | "recording"
  | "stopping"
  | "done"
  | "error";

/** Live snapshot for the meters, refreshed ~3x/sec while recording. */
export interface LiveSnapshot {
  metrics: DeliveryMetrics;
  score: SpeakingScore;
  instant: InstantAudio;
  transcript: string;
  partial: string;
  /** Length of the ongoing silence run in seconds (0 while speaking). */
  pausedNowSec: number;
}

const LIVE_TICK_MS = 300;

/**
 * Orchestrates one practice session. The mic stream is opened by Setup and
 * handed in via `start(stream)`; it's fanned out to Scribe (live transcript),
 * the audio-feature sampler (pitch/volume) and the recorder. The caller owns
 * the stream's lifecycle (Practice stops the tracks on finish/unmount).
 * "Finish" stops everything and returns a CompletedSession for the review.
 */
export function usePracticeSession() {
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [session, setSession] = useState<CompletedSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accumulatorRef = useRef<MetricsAccumulator | null>(null);
  const samplerRef = useRef<AudioFeatureSampler | null>(null);
  const recorderRef = useRef<SessionRecorder | null>(null);
  const scribeRef = useRef<ScribeRealtime | null>(null);
  const tickRef = useRef<number | null>(null);
  const partialRef = useRef("");
  // Guards live in refs so start()/finish() keep stable identities — if `phase`
  // state were a dependency, every transition would recreate them and re-run
  // the caller's mount effect, whose cleanup would tear down the live session.
  const phaseRef = useRef<SessionPhase>("idle");
  // start() is async; a StrictMode remount (or real unmount) mid-start bumps
  // `gen`, so the stale attempt abandons itself instead of clobbering — or
  // getting clobbered by — the live session.
  const genRef = useRef(0);
  const busyRef = useRef(false);

  const updatePhase = useCallback((p: SessionPhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

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
      partialRef.current,
    );
    return {
      metrics,
      score: computeSpeakingScore(metrics),
      instant,
      transcript: acc.transcript,
      partial: partialRef.current,
      pausedNowSec: samplerRef.current?.currentSilenceSec() ?? 0,
    };
  }, []);

  const start = useCallback(
    async (stream: MediaStream) => {
      if (
        busyRef.current ||
        phaseRef.current === "recording" ||
        phaseRef.current === "stopping"
      ) {
        return;
      }
      busyRef.current = true;
      const gen = ++genRef.current;
      const stale = () => genRef.current !== gen;
      setError(null);
      setSession(null);
      updatePhase("starting");
      // Pipeline pieces stay local until they're all live — a stale attempt
      // cleans up only what it created, never the refs a live session owns.
      let sampler: AudioFeatureSampler | null = null;
      let recorder: SessionRecorder | null = null;
      let scribe: ScribeRealtime | null = null;
      let committed = false;
      try {
        const accumulator = new MetricsAccumulator(Date.now());
        partialRef.current = "";

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
            partialRef.current = "";
          },
          onError: (message) => setError(message),
        });
        if (stale()) return;

        accumulatorRef.current = accumulator;
        samplerRef.current = sampler;
        recorderRef.current = recorder;
        scribeRef.current = scribe;
        committed = true;

        tickRef.current = window.setInterval(() => {
          setLive(takeSnapshot());
        }, LIVE_TICK_MS);
        updatePhase("recording");
      } catch (e) {
        if (!stale()) {
          setError(e instanceof Error ? e.message : String(e));
          updatePhase("error");
        }
      } finally {
        if (!committed) {
          void scribe?.stop().catch(() => {});
          void sampler?.stop().catch(() => {});
          void recorder?.stop().catch(() => {});
        }
        // Only the latest attempt releases the busy lock; a superseded one
        // leaves it for the attempt that replaced it.
        if (!stale()) busyRef.current = false;
      }
    },
    [takeSnapshot, updatePhase],
  );

  const finish = useCallback(async (): Promise<CompletedSession | null> => {
    if (phaseRef.current !== "recording") return null;
    updatePhase("stopping");
    if (tickRef.current != null) window.clearInterval(tickRef.current);

    await scribeRef.current?.stop();
    const recording = (await recorderRef.current?.stop()) ?? new Blob();
    const audioSummary = samplerRef.current?.summaries() ?? {
      pitch: null,
      volume: null,
    };
    const acousticPauses = samplerRef.current?.detectPauses();
    await samplerRef.current?.stop();

    const acc = accumulatorRef.current;
    if (!acc) {
      updatePhase("error");
      return null;
    }
    if (acc.allWords.length === 0 && acc.transcript.trim()) {
      acc.addCommitted("", synthesizeWords(acc.transcript, acc.elapsedSec()));
      acc.markSynthesized();
    }
    const metrics = acc.snapshot(
      Date.now(),
      audioSummary.pitch,
      audioSummary.volume,
      acousticPauses,
    );
    const completed: CompletedSession = {
      words: acc.allWords,
      durationSec: metrics.durationSec,
      transcript: acc.transcript,
      metrics,
      recording,
    };
    setSession(completed);
    setLive(null);
    updatePhase("done");
    return completed;
  }, [updatePhase]);

  useEffect(
    () => () => {
      genRef.current++;
      busyRef.current = false;
      if (tickRef.current != null) window.clearInterval(tickRef.current);
      void teardown(scribeRef, samplerRef, recorderRef);
    },
    [],
  );

  return { phase, live, session, error, start, finish };
}

async function teardown(
  scribeRef: React.RefObject<ScribeRealtime | null>,
  samplerRef: React.RefObject<AudioFeatureSampler | null>,
  recorderRef: React.RefObject<SessionRecorder | null>,
): Promise<void> {
  await scribeRef.current?.stop().catch(() => {});
  scribeRef.current = null;
  await samplerRef.current?.stop().catch(() => {});
  samplerRef.current = null;
  await recorderRef.current?.stop().catch(() => {});
  recorderRef.current = null;
}
