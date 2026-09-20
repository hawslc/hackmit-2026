// Runtime validation for request bodies. Express hands us `unknown`; these turn
// it into the shared contract types or reject with a 400 that names the problem.

import type {
  Concept,
  ExtractConceptsRequest,
  ReviewMaterial,
  ReviewRequestBody,
  WordTiming,
} from "@cadence/shared";
import { HttpError } from "./httpError.ts";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function invalid(message: string): never {
  throw new HttpError(400, message);
}

function requireRecord(value: unknown, where: string): UnknownRecord {
  return isRecord(value) ? value : invalid(`${where} must be an object.`);
}

function requireArray(value: unknown, where: string): unknown[] {
  return Array.isArray(value) ? value : invalid(`${where} must be an array.`);
}

function requireString(value: unknown, where: string): string {
  return typeof value === "string" ? value : invalid(`${where} must be a string.`);
}

function requireNumber(value: unknown, where: string): number {
  return typeof value === "number" && Number.isFinite(value) ? value : invalid(`${where} must be a number.`);
}

function optional<T>(value: unknown, parse: (v: unknown) => T): T | undefined {
  return value === undefined || value === null ? undefined : parse(value);
}

function parseFiles(value: unknown, where: string): ExtractConceptsRequest["files"] {
  return requireArray(value, where).map((raw, i) => {
    const file = requireRecord(raw, `${where}[${i}]`);
    return {
      name: requireString(file.name, `${where}[${i}].name`),
      text: requireString(file.text, `${where}[${i}].text`),
    };
  });
}

function parseConcepts(value: unknown, where: string): Concept[] {
  return requireArray(value, where).map((raw, i) => {
    const at = `${where}[${i}]`;
    const concept = requireRecord(raw, at);
    const parsed: Concept = { name: requireString(concept.name, `${at}.name`) };
    const source = optional(concept.source, (v) => requireString(v, `${at}.source`));
    const importance = optional(concept.importance, (v) => requireNumber(v, `${at}.importance`));
    if (source !== undefined) parsed.source = source;
    if (importance !== undefined) parsed.importance = importance;
    return parsed;
  });
}

function parseWords(value: unknown): WordTiming[] {
  const words = requireArray(value, "words");
  if (words.length === 0) invalid("words must contain at least one word.");
  return words.map((raw, i) => {
    const word = requireRecord(raw, `words[${i}]`);
    return {
      text: requireString(word.text, `words[${i}].text`),
      start: requireNumber(word.start, `words[${i}].start`),
      end: requireNumber(word.end, `words[${i}].end`),
    };
  });
}

/** POST /api/materials/concepts */
export function parseExtractConceptsRequest(body: unknown): ExtractConceptsRequest {
  const files = parseFiles(requireRecord(body, "Body").files, "files");
  if (files.length === 0) invalid("Send at least one file in files.");
  return { files };
}

/** POST /api/review */
export function parseReviewRequest(body: unknown): ReviewRequestBody {
  const raw = requireRecord(body, "Body");
  const words = parseWords(raw.words);
  const material = optional(raw.material, (v): ReviewMaterial => {
    const m = requireRecord(v, "material");
    return {
      files: parseFiles(m.files ?? [], "material.files"),
      concepts: parseConcepts(m.concepts ?? [], "material.concepts"),
    };
  });
  return material ? { words, material } : { words };
}
