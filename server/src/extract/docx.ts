// .docx — unzip, read word/document.xml, one line per `<w:p>` paragraph.

import { unzipSync } from "fflate";
import { HttpError } from "../httpError.ts";
import { decodeBytes, paragraphs } from "./ooxml.ts";

export function extractDocx(bytes: Uint8Array): string {
  const files = unzipSync(bytes) as Record<string, Uint8Array>;
  const doc = files["word/document.xml"];
  if (!doc) {
    throw new HttpError(422, "This .docx has no readable document body.");
  }
  return paragraphs(decodeBytes(doc), "w:p", "w:t").join("\n");
}
