// What the rest of the client sees of the backend. `http` and `mock` each
// implement it, and `api/index.ts` picks one, so callers never know which.

import type { SessionReview, SourceFile } from "@ta-coach/shared";
import type { CompletedSession, Concept, LectureMaterial } from "../types";

export interface MaterialsApi {
  /** One file per request. */
  uploadFile(file: File): Promise<SourceFile>;
  /** One deduplicated concept list across all files. */
  extractConcepts(files: SourceFile[]): Promise<Concept[]>;
}

export interface ReviewApi {
  requestReview(material: LectureMaterial, session: CompletedSession, signal?: AbortSignal): Promise<SessionReview>;
}

export interface Api {
  materials: MaterialsApi;
  review: ReviewApi;
}
