import { useCallback, useEffect, useState } from "react";
import { requestReview } from "../api/review";
import type { CompletedSession, LectureMaterial, SessionReview } from "../types";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; review: SessionReview };

/** Requests the review once on mount (and again on `retry`), ignoring results after unmount. */
export function useReview(material: LectureMaterial, session: CompletedSession) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    requestReview(material, session, controller.signal).then(
      (review) => {
        if (!controller.signal.aborted) setState({ status: "ready", review });
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
