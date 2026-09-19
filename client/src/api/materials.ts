import type { Concept, SourceFile } from "../types";

// Mock mode stays on until the server lands. Set VITE_USE_MOCK_API=false to hit the real API.
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== "false";

/** POST /api/materials/file: one file per request (multipart, field `file`). */
export async function uploadFile(file: File): Promise<SourceFile> {
  if (USE_MOCK) return mockUploadFile(file);
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/materials/file", { method: "POST", body });
  if (!res.ok) throw new Error(await errorMessage(res, `Couldn't read ${file.name}.`));
  return (await res.json()) as SourceFile;
}

/** POST /api/materials/concepts: one deduplicated concept list across all files. */
export async function extractConcepts(files: SourceFile[]): Promise<Concept[]> {
  if (USE_MOCK) return mockExtractConcepts(files);
  const res = await fetch("/api/materials/concepts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Couldn't extract key ideas."));
  const concepts = (await res.json()) as Omit<Concept, "origin">[];
  return concepts.map((c) => ({ ...c, origin: "extracted" as const }));
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) return data.error;
  } catch {
    // Not JSON; use the fallback.
  }
  return fallback;
}

// ---- Mock mode -------------------------------------------------------------
// Handy triggers for demoing the failure states:
//   filename contains "fail-upload"    → that upload errors
//   filename contains "long"           → the server reports truncation
//   filename contains "fail-concepts"  → concept extraction errors (until that file is removed)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (min: number, max: number) => min + Math.random() * (max - min);

async function mockUploadFile(file: File): Promise<SourceFile> {
  await sleep(jitter(600, 1800));
  if (file.name.includes("fail-upload")) throw new Error(`Couldn't read ${file.name}. Try again or remove it.`);
  return {
    name: file.name,
    size: file.size,
    text: `## Slide 1\nMock text extracted from ${file.name}`,
    truncated: file.name.includes("long") || undefined,
  };
}

const MOCK_CONCEPTS = [
  "Big-O notation describes growth rate",
  "Worst-case vs. average-case analysis",
  "Recursion needs a base case",
  "Divide and conquer",
  "Trade-offs between time and memory",
];

async function mockExtractConcepts(files: SourceFile[]): Promise<Concept[]> {
  await sleep(jitter(900, 1800));
  if (files.some((f) => f.name.includes("fail-concepts"))) throw new Error("Mock extraction failure");
  return files.length === 1
    ? MOCK_CONCEPTS.slice(0, 4).map((name, i) => mock(name, files[0], i))
    : MOCK_CONCEPTS.map((name, i) => mock(name, files[i % files.length], i));
}

function mock(name: string, file: SourceFile, i: number): Concept {
  return { name, source: `${file.name} · slide ${i + 2}`, importance: 5 - (i % 3), origin: "extracted" };
}
