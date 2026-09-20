import type { ExtractConceptsRequest, ExtractConceptsResponse, SourceFile } from "@cadence/shared";
import { postJson, requestJson } from "./http";
import type { MaterialsApi } from "./types";

/** POST /api/materials/file (multipart, field `file`) and POST /api/materials/concepts. */
export const materialsApi: MaterialsApi = {
  uploadFile(file) {
    const body = new FormData();
    body.append("file", file);
    return requestJson<SourceFile>("/api/materials/file", { method: "POST", body }, `Couldn't read ${file.name}.`);
  },

  async extractConcepts(files) {
    const request: ExtractConceptsRequest = { files };
    const concepts = await postJson<ExtractConceptsResponse>(
      "/api/materials/concepts",
      request,
      "Couldn't extract key ideas.",
    );
    return concepts.map((c) => ({ ...c, origin: "extracted" as const }));
  },
};
