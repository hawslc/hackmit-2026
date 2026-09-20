import { useRef, useState } from "react";
import type { UploadItem } from "../hooks/useMaterialSetup";
import { UPLOAD_LIMITS } from "@ta-coach/shared";
import { ACCEPT_ATTR, formatSize } from "../lib/validateFile";

interface Props {
  items: UploadItem[];
  /** Returns friendly messages for any files that were rejected. */
  onAdd: (files: File[]) => string[];
  onRemove: (id: string) => void;
  /** Whether the server reported truncation for this file. */
  truncated: (id: string) => boolean;
}

export default function FileUploader({ items, onAdd, onRemove, truncated }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);
  const full = items.length >= UPLOAD_LIMITS.maxFiles;

  const handle = (files: FileList | null) => {
    if (!files?.length) return;
    setNotices(onAdd(Array.from(files)));
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!full) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!full) handle(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? "border-brand-600 bg-brand-50" : "border-slate-300 bg-slate-50"
        } ${full ? "opacity-60" : ""}`}
      >
        <p className="text-sm text-slate-600">
          {full ? "You've added the maximum of 5 files." : "Drag lecture files here, or"}
        </p>
        <button
          type="button"
          disabled={full}
          onClick={() => inputRef.current?.click()}
          className="mt-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-brand-700 shadow-sm ring-1 ring-slate-300 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Upload files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            handle(e.target.files);
            e.target.value = ""; // lets the same file be picked again after removing it
          }}
        />
        <p className="mt-2 text-xs text-slate-500">
          .pptx, PDF, .docx, .txt or .md · up to {UPLOAD_LIMITS.maxFiles} files, {UPLOAD_LIMITS.maxBytes / (1024 * 1024)} MB each
        </p>
      </div>

      {notices.length > 0 && (
        <ul role="alert" className="mt-3 space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {notices.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={item.name}>
                  {item.name}
                </p>
                <p className="text-xs text-slate-500" aria-live="polite">
                  {formatSize(item.size)} ·{" "}
                  {item.status === "uploading" && "Uploading…"}
                  {item.status === "ready" && <span className="text-emerald-700">Ready</span>}
                  {item.status === "error" && <span className="text-red-700">Couldn't upload</span>}
                </p>
                {item.status === "error" && <p className="mt-1 text-xs text-red-700">{item.error}</p>}
                {item.status === "ready" && truncated(item.id) && (
                  <p className="mt-1 text-xs text-amber-800">
                    This file is long, so we only read the first part of it.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.name}`}
                className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
