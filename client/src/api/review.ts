import type { Concept as WireConcept, ReviewRequestBody, SessionReview } from "@cadence/shared";
import type { Concept } from "../types";
import { postJson } from "./http";
import type { ReviewApi } from "./types";

/** Strips client-only fields before a concept goes over the wire. */
const toWireConcept = ({ origin: _origin, ...concept }: Concept): WireConcept => concept;

/** POST /api/review */
export const reviewApi: ReviewApi = {
  requestReview(material, session, signal) {
    const request: ReviewRequestBody = {
      words: session.words,
      material: {
        files: material.files.map(({ name, text }) => ({ name, text })),
        concepts: material.concepts.map(toWireConcept),
      },
    };
    return postJson<SessionReview>("/api/review", request, "We couldn't review your session.", signal);
  },
};
