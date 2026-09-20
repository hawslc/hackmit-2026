import { useEffect, useRef } from "react";
import { usePracticeSession } from "../live/usePracticeSession";
import type { CompletedSession, LectureMaterial } from "../types";

interface Props {
  material: LectureMaterial;
  /** Already-open mic stream from Setup. Reuse it; don't call getUserMedia again. */
  stream: MediaStream;
  onFinish: (session: CompletedSession) => void;
}

export default function PracticeScreen({ material, stream, onFinish }: Props) {
  const { phase, live, error, start, finish } = usePracticeSession();

  // Safety net: release the mic if this screen unmounts any other way.
  useEffect(() => () => stream.getTracks().forEach((t) => t.stop()), [stream]);

  // The stream is already open, so the session starts on mount.
  useEffect(() => {
    void start(stream);
  }, [start, stream]);

  const done = useRef(false);
  const handleFinish = async () => {
    if (done.current) return;
    done.current = true;
    const session = await finish();
    if (session) onFinish(session);
    else done.current = false;
  };

  const m = live?.metrics;
  const finishing = phase === "stopping";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
      <div className="w-full rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
          <span className="size-2 animate-pulse rounded-full bg-red-600" aria-hidden />
          {phase === "recording" ? "Recording" : phase === "starting" ? "Starting…" : phase}
        </p>
        <h1 className="mt-4 text-xl font-semibold">Practice aloud</h1>
        <p className="mt-1 text-sm text-slate-500">
          {material.files.length} file{material.files.length === 1 ? "" : "s"} ·{" "}
          {material.concepts.length} concept{material.concepts.length === 1 ? "" : "s"}
        </p>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {live && (
          <p className="mt-4 text-sm text-slate-600">
            {m?.wpm.toFixed(0) ?? "—"} wpm · {m?.fillerCount ?? 0} fillers ·{" "}
            {m?.pauseCount ?? 0} pauses
          </p>
        )}
        {(live?.transcript || live?.partial) && (
          <p className="mt-3 max-h-32 overflow-y-auto text-left text-sm text-slate-700">
            {live.transcript} <em className="text-slate-400">{live.partial}</em>
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleFinish()}
          disabled={phase !== "recording"}
          className="mt-6 rounded-lg bg-brand-600 px-6 py-2.5 font-medium text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50"
        >
          {finishing ? "Finishing…" : "Finish"}
        </button>
      </div>
    </main>
  );
}
