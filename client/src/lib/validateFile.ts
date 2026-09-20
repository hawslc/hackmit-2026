import { ACCEPTED_EXTENSIONS, UPLOAD_LIMITS } from "@cadence/shared";

export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(",");

/** Legacy formats we can't read, with the export hint to show. */
const EXPORT_HINTS: Record<string, string> = {
  ".ppt": "export it as .pptx or PDF",
  ".key": "export it as .pptx or PDF (in Keynote: File → Export To)",
  ".doc": "save it as .docx or PDF",
  ".pages": "export it as .docx or PDF (in Pages: File → Export To)",
};

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Returns a friendly error message, or null if the file can be uploaded.
 * `existingNames` are the files already in the list (duplicates are matched by name).
 */
export function validateFile(file: File, existingNames: readonly string[]): string | null {
  const ext = extensionOf(file.name);
  const hint = EXPORT_HINTS[ext];
  if (hint) return `${file.name}: we can't read ${ext} files directly. Please ${hint}.`;
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `${file.name}: that file type isn't supported. Try .pptx, PDF, .docx, .txt or .md.`;
  }
  if (file.size === 0) return `${file.name}: this file is empty.`;
  if (file.size > UPLOAD_LIMITS.maxBytes) {
    return `${file.name} is ${formatSize(file.size)}. Files can be up to ${formatSize(UPLOAD_LIMITS.maxBytes)}.`;
  }
  const lower = file.name.toLowerCase();
  if (existingNames.some((n) => n.toLowerCase() === lower)) {
    return `${file.name} is already added.`;
  }
  return null;
}

export function tooManyFilesMessage(skipped: number): string {
  const s = skipped === 1 ? "file was" : "files were";
  return `You can add up to ${UPLOAD_LIMITS.maxFiles} files, so ${skipped} ${s} skipped.`;
}
