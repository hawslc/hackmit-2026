// Handy triggers for demoing the failure states:
//   filename contains "fail-upload"    → that upload errors
//   filename contains "long"           → the server reports truncation
//   filename contains "fail-concepts"  → concept extraction errors (until that file is removed)

import type { SourceFile } from "@ta-coach/shared";
import type { Concept } from "../../types";
import type { MaterialsApi } from "../types";
import { jitter, sleep } from "./delay";

const MOCK_CONCEPTS = [
  "Big-O notation describes growth rate",
  "Worst-case vs. average-case analysis",
  "Recursion needs a base case",
  "Divide and conquer",
  "Trade-offs between time and memory",
];

function mockConcept(name: string, file: SourceFile, i: number): Concept {
  return { name, source: `${file.name} · slide ${i + 2}`, importance: 5 - (i % 3), origin: "extracted" };
}

export const mockMaterialsApi: MaterialsApi = {
  async uploadFile(file) {
    await sleep(jitter(600, 1800));
    if (file.name.includes("fail-upload")) throw new Error(`Couldn't read ${file.name}. Try again or remove it.`);
    return {
      name: file.name,
      size: file.size,
      text: `## Slide 1\nMock text extracted from ${file.name}`,
      truncated: file.name.includes("long") || undefined,
    };
  },

  async extractConcepts(files) {
    await sleep(jitter(900, 1800));
    if (files.some((f) => f.name.includes("fail-concepts"))) throw new Error("Mock extraction failure");
    return files.length === 1
      ? MOCK_CONCEPTS.slice(0, 4).map((name, i) => mockConcept(name, files[0]!, i))
      : MOCK_CONCEPTS.map((name, i) => mockConcept(name, files[i % files.length]!, i));
  },
};
