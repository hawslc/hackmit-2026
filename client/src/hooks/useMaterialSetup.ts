import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractConcepts, uploadFile } from "../api/materials";
import { tooManyFilesMessage, UPLOAD_LIMITS, validateFile } from "../lib/validateFile";
import type { Concept, LectureMaterial, SourceFile } from "../types";

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "ready" | "error";
  error?: string;
  source?: SourceFile;
}

export type ExtractionStatus = "idle" | "loading" | "error";

const key = (name: string) => name.trim().toLowerCase();

/**
 * Setup-screen state: the uploaded files and the editable concept list.
 * Lives in App so the material survives a round trip to Practice and back.
 */
export function useMaterialSetup() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [extraction, setExtraction] = useState<ExtractionStatus>("idle");
  // Extracted concepts the TA removed; they stay dismissed when we re-extract.
  const dismissed = useRef(new Set<string>());
  const nextId = useRef(0);
  // Which set of ready files the last extraction ran for. Also guards against stale results via `run`.
  const extractedFor = useRef("");
  const run = useRef(0);
  const [retryTick, setRetryTick] = useState(0);

  const uploading = items.some((i) => i.status === "uploading");
  const ready = useMemo(() => items.filter((i) => i.status === "ready"), [items]);
  const readyKey = ready.map((i) => i.id).join(",");

  /** Adds files, returning friendly messages for any that were rejected. */
  const addFiles = useCallback(
    (files: File[]): string[] => {
      const errors: string[] = [];
      const names = items.map((i) => i.name);
      const accepted: File[] = [];
      let skipped = 0;
      for (const file of files) {
        const problem = validateFile(file, names);
        if (problem) {
          errors.push(problem);
        } else if (items.length + accepted.length >= UPLOAD_LIMITS.maxFiles) {
          skipped++;
        } else {
          accepted.push(file);
          names.push(file.name);
        }
      }
      if (skipped) errors.push(tooManyFilesMessage(skipped));
      if (!accepted.length) return errors;

      const added: UploadItem[] = accepted.map((f) => ({
        id: String(nextId.current++),
        name: f.name,
        size: f.size,
        status: "uploading",
      }));
      setItems((prev) => [...prev, ...added]);
      added.forEach((item, i) => {
        uploadFile(accepted[i]).then(
          (source) =>
            setItems((prev) =>
              prev.map((p) => (p.id === item.id ? { ...p, status: "ready", source } : p)),
            ),
          (err: unknown) =>
            setItems((prev) =>
              prev.map((p) =>
                p.id === item.id
                  ? { ...p, status: "error", error: err instanceof Error ? err.message : "Upload failed." }
                  : p,
              ),
            ),
        );
      });
      return errors;
    },
    [items],
  );

  const removeFile = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), []);

  // Re-extract once uploads settle and the set of ready files has changed.
  useEffect(() => {
    if (uploading) return;
    const files = ready.map((i) => i.source!);
    if (readyKey === extractedFor.current) return;
    extractedFor.current = readyKey;
    const mine = ++run.current;

    if (!files.length) {
      setConcepts((prev) => prev.filter((c) => c.origin === "user"));
      setExtraction("idle");
      return;
    }
    setExtraction("loading");
    extractConcepts(files).then(
      (extracted) => {
        if (mine !== run.current) return;
        setConcepts((prev) => {
          const user = prev.filter((c) => c.origin === "user");
          const taken = new Set(user.map((c) => key(c.name)));
          const fresh = extracted.filter((c) => {
            const k = key(c.name);
            if (dismissed.current.has(k) || taken.has(k)) return false;
            taken.add(k);
            return true;
          });
          return [...fresh, ...user];
        });
        setExtraction("idle");
      },
      () => {
        if (mine !== run.current) return;
        setExtraction("error");
      },
    );
    // `ready` is derived from `items`; readyKey captures exactly what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploading, readyKey, retryTick]);

  const retryExtraction = useCallback(() => {
    extractedFor.current = ""; // forces the effect to treat the ready files as new
    setRetryTick((t) => t + 1);
  }, []);

  const removeConcept = useCallback((concept: Concept) => {
    if (concept.origin === "extracted") dismissed.current.add(key(concept.name));
    setConcepts((prev) => prev.filter((c) => c !== concept));
  }, []);

  /** Returns false if the name was empty or already present. */
  const addConcept = useCallback(
    (name: string): boolean => {
      const trimmed = name.trim();
      if (!trimmed || concepts.some((c) => key(c.name) === key(trimmed))) return false;
      dismissed.current.delete(key(trimmed));
      setConcepts((prev) => [...prev, { name: trimmed, origin: "user" }]);
      return true;
    },
    [concepts],
  );

  const material: LectureMaterial = useMemo(
    () => ({ files: ready.map((i) => i.source!), concepts }),
    [ready, concepts],
  );

  return {
    items,
    concepts,
    extraction,
    uploading,
    material,
    addFiles,
    removeFile,
    removeConcept,
    addConcept,
    retryExtraction,
  };
}

export type MaterialSetup = ReturnType<typeof useMaterialSetup>;
