import { useState } from "react";
import logo from "../assets/logo.png";
import ConceptChips from "../components/ConceptChips";
import FileUploader from "../components/FileUploader";
import type { MaterialSetup } from "../hooks/useMaterialSetup";

interface Props {
  setup: MaterialSetup;
  /** Called with the open mic stream once permission is granted. */
  onStart: (stream: MediaStream) => void;
}

function micErrorMessage(err: unknown): string {
  if (!window.isSecureContext || !navigator.mediaDevices) {
    return "Microphone access needs a secure page (https or localhost). Open the app from one of those and try again.";
  }
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access is blocked. Click the lock icon in your browser's address bar, allow the microphone, then press Start practice again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "We couldn't find a microphone. Plug one in (or check your system sound settings) and try again.";
  }
  if (name === "NotReadableError") {
    return "Your microphone is being used by another app. Close it and try again.";
  }
  return "We couldn't start the microphone. Please try again.";
}

export default function SetupScreen({ setup, onStart }: Props) {
  const [requesting, setRequesting] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const { items, concepts, extraction, uploading, material } = setup;

  const hasReadyFile = material.files.length > 0;
  const showConcepts = hasReadyFile || concepts.length > 0;
  const finding = extraction === "loading";
  const busy = uploading || finding;

  const truncatedById = new Map(items.map((i) => [i.id, i.source?.truncated === true]));

  // getUserMedia must be called directly from the click so the browser treats it as a user gesture.
  const start = async () => {
    setMicError(null);
    setRequesting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("no mediaDevices");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      onStart(stream);
    } catch (err) {
      setMicError(micErrorMessage(err));
      setRequesting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
      <div className="w-full space-y-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <header className="flex items-center gap-3">
          <img src={logo} alt="" className="h-10 w-auto" />
          <div>
            <h1 className="text-2xl font-bold text-brand-700">Cadence</h1>
            <p className="mt-1 text-slate-600">Upload your materials, then teach out loud.</p>
          </div>
        </header>

        <section aria-labelledby="materials-heading">
          <h2 id="materials-heading" className="text-base font-semibold">
            Lecture materials <span className="font-normal text-slate-500">(optional)</span>
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            Add your slides or notes and we'll check what you covered afterwards.
          </p>
          <FileUploader
            items={items}
            onAdd={setup.addFiles}
            onRemove={setup.removeFile}
            truncated={(id) => truncatedById.get(id) ?? false}
          />
        </section>

        {showConcepts && (
          <section aria-label="Key concepts">
            <ConceptChips
              concepts={concepts}
              status={extraction}
              onRemove={setup.removeConcept}
              onAdd={setup.addConcept}
              onRetry={setup.retryExtraction}
            />
          </section>
        )}

        <div>
          <button
            type="button"
            onClick={start}
            disabled={busy || requesting}
            className="w-full rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {requesting ? "Requesting microphone…" : "Start practice"}
          </button>
          <p className="mt-2 text-center text-sm text-slate-500" aria-live="polite">
            {uploading
              ? "Uploading…"
              : finding
                ? "Finding key ideas…"
                : !hasReadyFile
                  ? "No materials? No problem. We'll skip the content review and still coach your delivery."
                  : "Recording starts as soon as you click. You'll finish when you're ready."}
          </p>
          {micError && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {micError}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
