// Dispatch a single uploaded file to the right extractor by extension, verifying
// magic bytes so a renamed file gets a friendly error instead of a crash. Text
// beyond UPLOAD_LIMITS.maxChars is truncated (not rejected) and flagged.

import { UPLOAD_LIMITS } from "@ta-coach/shared";
import { HttpError } from "../httpError.ts";
import { extractDocx } from "./docx.ts";
import { extractPdf } from "./pdf.ts";
import { extractPptx } from "./pptx.ts";
import { extractPlain } from "./text.ts";

export interface Extracted {
  text: string;
  truncated: boolean;
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04" (pptx/docx are zips)

// Formats we deliberately reject, with how to export to a supported one.
const REJECTED: Record<string, string> = {
  ppt: "Old PowerPoint (.ppt) isn't supported. In PowerPoint: File → Save As → .pptx, then upload that.",
  doc: "Old Word (.doc) isn't supported. In Word: File → Save As → .docx, then upload that.",
  key: "Keynote (.key) isn't supported. In Keynote: File → Export To → PowerPoint (.pptx), then upload that.",
  pages: "Pages (.pages) isn't supported. In Pages: File → Export To → Word (.docx), then upload that.",
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.length < sig.length) return false;
  return sig.every((b, i) => bytes[i] === b);
}

export async function extractFile(name: string, bytes: Uint8Array): Promise<Extracted> {
  const ext = extensionOf(name);

  const rejected = REJECTED[ext];
  if (rejected) throw new HttpError(415, rejected);

  let text: string;
  switch (ext) {
    case "txt":
    case "md":
      text = extractPlain(bytes);
      break;
    case "pdf":
      if (!startsWith(bytes, PDF_MAGIC)) throw badMagic(name, "PDF");
      text = await extractPdf(bytes);
      break;
    case "pptx":
      if (!startsWith(bytes, ZIP_MAGIC)) throw badMagic(name, ".pptx");
      text = extractPptx(bytes);
      break;
    case "docx":
      if (!startsWith(bytes, ZIP_MAGIC)) throw badMagic(name, ".docx");
      text = extractDocx(bytes);
      break;
    default:
      throw new HttpError(
        415,
        `Unsupported file type "${ext ? "." + ext : name}". Upload a .pptx, .pdf, .docx, .txt or .md.`,
      );
  }

  if (text.length > UPLOAD_LIMITS.maxChars) {
    return { text: text.slice(0, UPLOAD_LIMITS.maxChars), truncated: true };
  }
  return { text, truncated: false };
}

function badMagic(name: string, kind: string): HttpError {
  return new HttpError(415, `"${name}" doesn't look like a real ${kind} file (its contents don't match its name).`);
}
