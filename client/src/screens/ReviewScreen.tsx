import ContentGaps from "../components/ContentGaps";
import FactualIssues from "../components/FactualIssues";
import SectionCard from "../components/SectionCard";
import { useReview } from "../hooks/useReview";
import { pickHighlighted } from "../lib/reviewView";
import type { CompletedSession, LectureMaterial } from "../types";

interface Props {
  material: LectureMaterial;
  session: CompletedSession;
  onPracticeAgain: () => void;
}

const primaryButton =
  "rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

export default function ReviewScreen({ material, session, onPracticeAgain }: Props) {
  const state = useReview(material, session);

  if (state.status === "loading") {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-8">
        <div role="status" className="text-center">
          <div
            className="mx-auto size-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600"
            aria-hidden
          />
          <p className="mt-4 text-lg font-medium">Reviewing your session…</p>
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
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
              onClick={onPracticeAgain}
              className="rounded-xl px-6 py-3 text-base font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Back to setup
            </button>
          </div>
        </div>
      </main>
    );
  }

  const { review } = state;
  const highlighted = pickHighlighted(review.sections, 2);

  return (
    <main className="mx-auto min-h-screen max-w-xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold text-brand-700">Your review</h1>
        <p className="mt-2 text-slate-600">{review.summary}</p>
        <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3">
          <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Top priority</p>
          <p className="mt-1 text-sm text-slate-800">{review.topPriority}</p>
        </div>
      </header>

      <div className="space-y-3">
        {review.sections.map((section) => (
          <SectionCard
            key={section.id}
            title={section.title}
            result={section.result}
            highlighted={highlighted.has(section.id)}
          />
        ))}
      </div>

      <ContentGaps result={review.gaps} />
      <FactualIssues result={review.factualIssues} />

      <button type="button" onClick={onPracticeAgain} className={`${primaryButton} w-full`}>
        Practice again
      </button>
    </main>
  );
}
