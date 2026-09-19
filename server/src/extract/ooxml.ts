// Shared helpers for the OOXML formats (.pptx, .docx). Both are zip archives of
// XML; we pull text runs with small regexes rather than adding an XML-parser
// dependency. Good enough for slide/paragraph text and speaker notes.

const decoder = new TextDecoder("utf-8");

export function decodeBytes(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/** Decode the five XML entities (and numeric refs). &amp; last, to avoid double-decoding. */
export function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/** Concatenated text of every `<tag>…</tag>` run in a fragment (runs within a paragraph). */
export function runText(fragment: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  let out = "";
  for (const m of fragment.matchAll(re)) out += decodeXmlEntities(m[1] ?? "");
  return out;
}

/**
 * Text of each paragraph (`pTag`) in document order, one string per paragraph,
 * empty paragraphs dropped. Runs (`tTag`) inside a paragraph join with no
 * separator; callers join paragraphs with newlines.
 */
export function paragraphs(xml: string, pTag: string, tTag: string): string[] {
  const re = new RegExp(`<${pTag}\\b[\\s\\S]*?</${pTag}>`, "g");
  const out: string[] = [];
  for (const m of xml.matchAll(re)) {
    const text = runText(m[0], tTag).trim();
    if (text) out.push(text);
  }
  return out;
}
