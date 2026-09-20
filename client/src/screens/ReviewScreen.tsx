import { useEffect, useState } from "react";
import CoachingCardView from "../components/CoachingCardView";
import DeliveryMetricsCard from "../components/DeliveryMetricsCard";
import DevModal from "../components/DevModal";
import { useReview } from "../hooks/useReview";
import type { CompletedSession, LectureMaterial } from "../types";

interface Props {
  material: LectureMaterial;
  session: CompletedSession;
  /** Carries the focus card's practice goal into the next session. */
  onPracticeAgain: (practiceGoal?: string) => void;
}

const primaryButton =
  "rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

export default function ReviewScreen({ material, session, onPracticeAgain }: Props) {
  const state = useReview(material, session);
  const [devOpen, setDevOpen] = useState(false);

  // Dev tool: "d" toggles an inspector for the raw server response; Esc closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        setDevOpen((open) => !open);
      } else if (e.key === "Escape") {
        setDevOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const devModal = devOpen && (
    <DevModal
      status={state.status}
      raw={state.status === "ready" ? state.review : undefined}
      material={material}
      session={session}
      onClose={() => setDevOpen(false)}
    />
  );

  if (state.status === "loading") {
    return (
      <>
        {devModal}
        <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-8">
          <div role="status" className="text-center">
            <div
              className="mx-auto size-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600"
              aria-hidden
            />
            <p className="mt-4 text-lg font-medium">Reviewing your session…</p>
          </div>
        </main>
      </>
    );
  }

  if (state.status === "error") {
    return (
      <>
        {devModal}
        <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
          <div className="w-full rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 sm:p-8">
            <h1 className="text-xl font-semibold">We couldn't review your session</h1>
            <p role="alert" className="mt-1 text-sm text-slate-600">
              Something went wrong on our end. Your materials are still saved.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={state.retry} className={primaryButton}>
                Retry
              </button>
              <button
                type="button"
                onClick={() => onPracticeAgain()}
                className="rounded-xl px-6 py-3 text-base font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Back to setup
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  const { review } = state;
  const coached = review.evidenceState === "coached" && review.focus;

  return (
    <>
      {devModal}
      <main className="mx-auto min-h-screen max-w-xl space-y-6 px-4 py-8">
        <DeliveryMetricsCard session={session} />

        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Transcript
          </h2>
          <p className="mt-2 max-h-48 overflow-y-auto text-sm leading-relaxed text-slate-700">
            {session.transcript.trim() || (
              <span className="text-slate-400">No speech was captured in this session.</span>
            )}
          </p>
        </section>

        {coached ? (
          <div className="space-y-3">
            <CoachingCardView card={review.focus!} />
            {review.more.map((c, i) => (
              <CoachingCardView key={i} card={c} collapsible />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-white p-5 text-sm text-slate-600 ring-1 ring-slate-200">
            Not enough to evaluate yet — record a longer segment and try again.
          </p>
        )}

        <button
          type="button"
          onClick={() => onPracticeAgain(review.focus?.practiceGoal)}
          className={`${primaryButton} w-full`}
        >
          Practice again
        </button>
      </main>
    </>
  );
}
