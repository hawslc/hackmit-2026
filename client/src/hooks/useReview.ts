import { useCallback, useEffect, useState } from "react";
import type { SessionReview } from "@cadence/shared";
import { api } from "../api";
import { toReviewView } from "../lib/reviewView";
import type { CompletedSession, LectureMaterial, ReviewView } from "../types";

type State =
  | { status: "loading" }
  | { status: "error" }
  // `raw` is the untouched server response, kept alongside the mapped view so the
  // dev tool (press "d" on the Review screen) can show exactly what came back.
  | { status: "ready"; review: ReviewView; raw: SessionReview };

/** Requests the review once on mount (and again on `retry`), ignoring results after unmount. */
export function useReview(material: LectureMaterial, session: CompletedSession) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    api.review.requestReview(material, session, controller.signal).then(
      (review) => {
        if (!controller.signal.aborted)
          setState({ status: "ready", review: toReviewView(review), raw: review });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: "error" });
      },
    );
    return () => controller.abort();
    // The session is fixed for this screen's lifetime; only Retry re-runs the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, retry };
}
