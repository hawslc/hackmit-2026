import { useEffect } from "react";
import { wordsFromTranscript } from "../lib/transcript";
import type { CompletedSession, LectureMaterial } from "../types";

interface Props {
  material: LectureMaterial;
  /** Already-open mic stream from Setup. Reuse it; don't call getUserMedia again. */
  stream: MediaStream;
  onFinish: (session: CompletedSession) => void;
}

// TODO(live): replace this stub with the live session: Scribe transcription, Web Audio meters,
// MediaRecorder and the live speaking score, all driven from `stream`. Finish hands a real
// CompletedSession to Review; for now it's a fake one.
export default function PracticeScreen({ material, stream, onFinish }: Props) {
  // Safety net: release the mic if this screen unmounts any other way.
  useEffect(() => () => stream.getTracks().forEach((t) => t.stop()), [stream]);

  const finish = () => {
    stream.getTracks().forEach((t) => t.stop());
    // TODO(live): real word timings from Scribe.
    const words = wordsFromTranscript("So one plus two is four, which is why the loop runs again.");
    onFinish({ words, durationSec: words.at(-1)?.end ?? 0 });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
      <div className="w-full rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
          <span className="size-2 animate-pulse rounded-full bg-red-600" aria-hidden />
          Microphone active
        </p>
        <h1 className="mt-4 text-xl font-semibold">Live practice goes here</h1>
        <p className="mt-1 text-sm text-slate-500">TODO(live)</p>
        <p className="mt-4 text-sm text-slate-600">
          {material.files.length} file{material.files.length === 1 ? "" : "s"} ·{" "}
          {material.concepts.length} concept{material.concepts.length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={finish}
          className="mt-6 rounded-lg bg-brand-600 px-6 py-2.5 font-medium text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          Finish
        </button>
      </div>
    </main>
  );
}
