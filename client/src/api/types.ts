// What the rest of the client sees of the backend. The HTTP client in this
// folder implements it and `api/index.ts` wires it up, so callers only ever
// see this interface.

import type { SessionReview, SourceFile } from "@cadence/shared";
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
