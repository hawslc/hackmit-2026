import { useEffect, useState } from "react";
import { computeSpeakingScore, type SpeakingScoreComponents } from "@cadence/shared";
import type { CompletedSession } from "../types";

interface Props {
  session: CompletedSession;
}

const COMPONENT_LABELS: Record<keyof SpeakingScoreComponents, string> = {
  pace: "Pace",
  pauses: "Pauses",
  fillers: "Fillers",
  intonation: "Intonation",
  volume: "Volume",
};

function pillClass(score: number): string {
  if (score >= 80) return "bg-emerald-50 text-emerald-800";
  if (score >= 60) return "bg-brand-100 text-brand-700";
  return "bg-amber-50 text-amber-900";
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Delivery metrics + the recording playback, from the live practice session. */
export default function DeliveryMetricsCard({ session }: Props) {
  const { metrics, recording } = session;
  const score = computeSpeakingScore(metrics);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  // The audio element's own duration — matches the playback file exactly,
  // unlike metrics.durationSec which includes connect/shutdown overhead.
  const [audioSec, setAudioSec] = useState<number | null>(null);

  useEffect(() => {
    if (recording.size === 0) return;
    const url = URL.createObjectURL(recording);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recording]);

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Delivery</h3>
          <p className="mt-0.5 text-sm text-slate-500">How you sounded — {formatDuration(audioSec ?? metrics.durationSec)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${pillClass(score.overall)}`}>
          {score.overall}
          <span className="font-normal opacity-70"> / 100</span>
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Words / min" value={Math.round(metrics.wpm)} />
        <Metric label="Fillers / min" value={metrics.fillersPerMin.toFixed(1)} />
        <Metric label="Pauses" value={metrics.pauseCount} />
        <Metric
          label="Pitch"
          value={metrics.pitch ? `${Math.round(metrics.pitch.meanHz)} Hz` : "—"}
        />
      </dl>

      <ul className="mt-4 space-y-2">
        {(Object.keys(COMPONENT_LABELS) as (keyof SpeakingScoreComponents)[]).map((key) => {
          const value = score.components[key];
          return (
            <li key={key} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm text-slate-600">{COMPONENT_LABELS[key]}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                {value != null && (
                  <span
                    className="block h-full rounded-full bg-brand-600"
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

      {audioUrl && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Your recording
          </p>
          <audio
            controls
            src={audioUrl}
            className="w-full"
            onLoadedMetadata={(e) => {
              const el = e.currentTarget;
              if (Number.isFinite(el.duration)) {
                setAudioSec(el.duration);
              } else {
                // MediaRecorder webm blobs can lack a duration; seeking to the
                // end makes the browser resolve it (fired via durationchange).
                el.currentTime = Number.MAX_SAFE_INTEGER;
              }
            }}
            onDurationChange={(e) => {
              const el = e.currentTarget;
              if (Number.isFinite(el.duration)) {
                setAudioSec(el.duration);
                if (el.currentTime > 1e6) el.currentTime = 0;
              }
            }}
          />
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <dd className="text-lg font-semibold tabular-nums text-slate-800">{value}</dd>
      <dt className="mt-0.5 text-xs text-slate-500">{label}</dt>
    </div>
  );
}
