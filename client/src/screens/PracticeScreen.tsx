import { useEffect, useRef } from "react";
import type { SpeakingScoreComponents } from "@ta-coach/shared";
import { usePracticeSession } from "../live/usePracticeSession";
import type { CompletedSession, LectureMaterial } from "../types";

interface Props {
  material: LectureMaterial;
  /** Already-open mic stream from Setup. Reuse it; don't call getUserMedia again. */
  stream: MediaStream;
  onFinish: (session: CompletedSession) => void;
  /** Leave practice without a session (e.g. capture couldn't start). */
  onCancel: () => void;
}

const COMPONENT_LABELS: Record<keyof SpeakingScoreComponents, string> = {
  pace: "Pace",
  pauses: "Pauses",
  fillers: "Fillers",
  intonation: "Intonation",
  volume: "Volume",
};

function scoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-brand-600";
  return "bg-amber-500";
}

export default function PracticeScreen({ material, stream, onFinish, onCancel }: Props) {
  const { phase, live, error, start, finish } = usePracticeSession();
  const startedRef = useRef(false);

  // Kick off capture once from the stream Setup handed us. The ref guard keeps
  // StrictMode's double-mount from starting two sessions.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start(stream);
  }, [start, stream]);

  const stopStream = () => stream.getTracks().forEach((t) => t.stop());

  const handleFinish = async () => {
    const session = await finish();
    stopStream();
    if (session) onFinish(session);
  };

  const handleCancel = () => {
    stopStream();
    onCancel();
  };

  if (phase === "error") {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
        <div className="w-full rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 sm:p-8">
          <h1 className="text-xl font-semibold">Practice couldn't start</h1>
          <p role="alert" className="mt-2 text-sm text-slate-600">
            {error ?? "Something went wrong starting the microphone session."}
          </p>
          <button
            type="button"
            onClick={handleCancel}
            className="mt-6 rounded-lg bg-brand-600 px-6 py-2.5 font-medium text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Back to setup
          </button>
        </div>
      </main>
    );
  }

  const m = live?.metrics;
  const overall = live?.score.overall ?? 0;

  return (
    <main className="mx-auto min-h-screen max-w-xl space-y-5 px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-700">Teach out loud</h1>
          <p className="mt-1 text-sm text-slate-500">
            {material.files.length} file{material.files.length === 1 ? "" : "s"} ·{" "}
            {material.concepts.length} concept{material.concepts.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
          <span className="size-2 animate-pulse rounded-full bg-red-600" aria-hidden />
          {phase === "starting" ? "Connecting…" : phase === "stopping" ? "Wrapping up…" : "Recording"}
        </span>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      {/* Live speaking score */}
      <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Speaking score
          </h2>
          <p className="text-3xl font-bold text-brand-700">
            {overall}
            <span className="text-base font-normal text-slate-400"> / 100</span>
          </p>
        </div>
        <ul className="mt-4 space-y-2">
          {(Object.keys(COMPONENT_LABELS) as (keyof SpeakingScoreComponents)[]).map((key) => {
            const value = live?.score.components[key] ?? null;
            return (
              <li key={key} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm text-slate-600">
                  {COMPONENT_LABELS[key]}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  {value != null && (
                    <span
                      className={`block h-full rounded-full ${scoreColor(value)}`}
                      style={{ width: `${value}%` }}
                    />
                  )}
                </span>
                <span className="w-8 shrink-0 text-right text-sm tabular-nums text-slate-500">
                  {value ?? "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Live metrics */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Words / min" value={m ? Math.round(m.wpm) : "—"} />
        <Stat label="Fillers / min" value={m ? m.fillersPerMin.toFixed(1) : "—"} />
        <Stat label="Pauses" value={m ? m.pauseCount : "—"} />
        <Stat label="Pitch" value={live?.instant.pitchHz ? `${Math.round(live.instant.pitchHz)} Hz` : "—"} />
        <Stat label="Volume" value={live ? live.instant.rms.toFixed(3) : "—"} />
        <Stat label="Words" value={m ? m.wordCount : "—"} />
      </section>

      {/* Live transcript */}
      <section className="min-h-24 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">Transcript</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          {live?.transcript}
          {live?.partial && <span className="text-slate-400 italic"> {live.partial}</span>}
          {!live?.transcript && !live?.partial && (
            <span className="text-slate-400">Start talking — your words will appear here.</span>
          )}
        </p>
      </section>

      <button
        type="button"
        onClick={() => void handleFinish()}
        disabled={phase !== "recording"}
        className="w-full rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {phase === "stopping" ? "Finishing…" : "Finish"}
      </button>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white p-4 text-center ring-1 ring-slate-200">
      <p className="text-xl font-semibold tabular-nums text-slate-800">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}
