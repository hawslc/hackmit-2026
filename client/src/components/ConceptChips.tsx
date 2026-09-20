import { useState, type KeyboardEvent } from "react";
import type { ExtractionStatus } from "../hooks/useMaterialSetup";
import type { Concept } from "../types";

interface Props {
  concepts: Concept[];
  status: ExtractionStatus;
  onRemove: (concept: Concept) => void;
  onAdd: (name: string) => boolean;
  onRetry: () => void;
}

export default function ConceptChips({ concepts, status, onRemove, onAdd, onRetry }: Props) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    if (raw.trim()) onAdd(raw); // duplicates and blanks are ignored by onAdd
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    }
  };

  return (
    <div>
      <h2 className="text-base font-semibold">Key concepts</h2>
      <p className="text-sm text-slate-500">What should students walk away knowing?</p>

      <div aria-live="polite" className="mt-3">
        {status === "loading" && <p className="text-sm text-slate-600">Finding key ideas…</p>}
        {status === "idle" && concepts.length === 0 && (
          <p className="text-sm text-slate-600">No key ideas found. Add your own below.</p>
        )}
        {status === "error" && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span>Couldn't find key ideas automatically. You can add them yourself.</span>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md px-2 py-1 font-medium underline hover:bg-amber-100"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {concepts.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {concepts.map((c) => (
            <li
              key={c.name}
              title={c.source}
              className={`flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-sm ${
                c.origin === "user" ? "bg-emerald-50 text-emerald-900" : "bg-brand-100 text-brand-700"
              }`}
            >
              <span>{c.name}</span>
              <button
                type="button"
                onClick={() => onRemove(c)}
                aria-label={`Remove concept ${c.name}`}
                className="rounded-full px-2 py-0.5 hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="mt-3 block">
        <span className="sr-only">Add a concept</span>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commit(draft)}
          placeholder="Add a concept (press Enter)"
          maxLength={120}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-brand-600 focus:outline-2 focus:outline-brand-600/30"
        />
      </label>
    </div>
  );
}
