// .pdf — unpdf (pdf.js) text per page, one `## Page N` section each. Scanned /
// image-only PDFs have no selectable text and are rejected with a clear message.

import { extractText, getDocumentProxy } from "unpdf";
import { HttpError } from "../httpError.ts";

export async function extractPdf(bytes: Uint8Array): Promise<string> {
  // unpdf rejects a Node Buffer (a Uint8Array subclass); hand it a plain Uint8Array.
  const data = bytes.constructor === Uint8Array ? bytes : new Uint8Array(bytes);
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];

  const sections: string[] = [];
  pages.forEach((pageText, i) => {
    const t = (pageText ?? "").trim();
    if (t) sections.push(`## Page ${i + 1}\n${t}`);
  });

  if (sections.length === 0) {
    throw new HttpError(
      422,
      "This PDF has no selectable text (is it a scan or image-only?). Export a text-based PDF and try again.",
    );
  }
  return sections.join("\n\n");
}
