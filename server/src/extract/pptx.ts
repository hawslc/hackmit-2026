// .pptx — unzip, read slide XML in numeric order (≈ presentation order, an
// accepted simplification), skip hidden slides, include speaker notes. One
// `## Slide N` section per visible slide so concepts can cite the source.

import { unzipSync } from "fflate";
import { HttpError } from "../httpError.ts";
import { decodeBytes, paragraphs } from "./ooxml.ts";

type Zip = Record<string, Uint8Array>;

export function extractPptx(bytes: Uint8Array): string {
  const files = unzipSync(bytes) as Zip;

  const slides = Object.keys(files)
    .map((path) => {
      const m = /^ppt\/slides\/slide(\d+)\.xml$/.exec(path);
      return m && m[1] ? { path, n: Number(m[1]) } : null;
    })
    .filter((x): x is { path: string; n: number } => x !== null)
    .sort((a, b) => a.n - b.n);

  if (slides.length === 0) {
    throw new HttpError(422, "This .pptx has no slides we can read.");
  }

  const sections: string[] = [];
  for (const { path, n } of slides) {
    const entry = files[path];
    if (!entry) continue;
    const xml = decodeBytes(entry);

    // Hidden slide: <p:sld ... show="0">. Skip it.
    if (/<p:sld\b[^>]*\bshow="0"/.test(xml)) continue;

    const lines = paragraphs(xml, "a:p", "a:t");
    const notes = notesFor(n, files);

    const parts = [`## Slide ${n}`];
    if (lines.length) parts.push(lines.join("\n"));
    if (notes) parts.push(`Speaker notes: ${notes}`);
    sections.push(parts.join("\n"));
  }

  return sections.join("\n\n");
}

/** Follow slideN.xml.rels to its notesSlide and pull the notes text, if any. */
function notesFor(slideN: number, files: Zip): string {
  const rels = files[`ppt/slides/_rels/slide${slideN}.xml.rels`];
  if (!rels) return "";

  const m = /Target="([^"]*notesSlide\d+\.xml)"/.exec(decodeBytes(rels));
  if (!m || !m[1]) return "";

  // Target is relative to ppt/slides/, e.g. "../notesSlides/notesSlide1.xml".
  const target = m[1].replace(/^\.\.\//, "ppt/");
  const note = files[target];
  if (!note) return "";

  return paragraphs(decodeBytes(note), "a:p", "a:t").join(" ").trim();
}
