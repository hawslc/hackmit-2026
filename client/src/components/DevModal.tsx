import { useState } from "react";
import type { SessionReview } from "@ta-coach/shared";
import type { CompletedSession, LectureMaterial } from "../types";

interface Props {
  /** Review request status, mirrored from `useReview`. */
  status: "loading" | "error" | "ready";
  /** The untouched server response, once it has arrived. */
  raw?: SessionReview;
  /** What the client sent to produce it. */
  material: LectureMaterial;
  session: CompletedSession;
  onClose: () => void;
}

/** A compact view of what the client posted to POST /api/review. */
function requestPayload(material: LectureMaterial, session: CompletedSession) {
  return {
    wordCount: session.words.length,
    durationSec: session.durationSec,
    transcript: session.transcript,
    metrics: session.metrics,
    material: {
      files: material.files.map((f) => ({ name: f.name, textChars: f.text.length })),
      concepts: material.concepts.map((c) => ({ name: c.name, importance: c.importance, origin: c.origin })),
    },
  };
}

function Json({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

/**
 * Developer inspector for the raw review pipeline. Opened with "d" on the Review
 * screen; shows exactly what the server returned (and what was sent to it), so
 * you can confirm the wiring without opening devtools. Not shown to end users.
 */
export default function DevModal({ status, raw, material, session, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!raw) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(raw, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Developer inspector"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Dev · server response</h2>
            <p className="text-xs text-slate-500">POST /api/review — press d or Esc to close</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              disabled={!raw}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-40"
            >
              {copied ? "Copied" : "Copy JSON"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </header>

        <div className="space-y-4 px-5 py-4">
          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Server response (SessionReview)
            </h3>
            {status === "loading" && <p className="text-sm text-slate-500">Waiting for the server…</p>}
            {status === "error" && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                The review request failed. Check the server logs and network tab.
              </p>
            )}
            {status === "ready" && raw && <Json value={raw} />}
          </section>

          <details>
            <summary className="cursor-pointer text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Request sent
            </summary>
            <div className="mt-2">
              <Json value={requestPayload(material, session)} />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
