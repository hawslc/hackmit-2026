import type { CoverageStatus, SectionResult } from "@ta-coach/shared";
import type { ConceptCoverageItem, SectionDetail } from "../types";

interface Props {
  title: string;
  result: SectionResult<SectionDetail>;
  /** One of the lowest-scoring sections: shows specific feedback, not just the score. */
  highlighted: boolean;
}

const card = "rounded-2xl bg-white p-5 ring-1 ring-slate-200";

// Green = covered, amber = partly, red = not covered.
const COVERAGE: Record<CoverageStatus, { label: string; row: string; pill: string; dot: string }> = {
  covered: { label: "Covered", row: "bg-emerald-50", pill: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  partial: { label: "Partly covered", row: "bg-amber-50", pill: "bg-amber-100 text-amber-900", dot: "bg-amber-500" },
  missing: { label: "Not covered", row: "bg-red-50", pill: "bg-red-100 text-red-800", dot: "bg-red-500" },
};

function CoverageList({ concepts }: { concepts: ConceptCoverageItem[] }) {
  return (
    <ul className="mt-4 space-y-2">
      {concepts.map((c, i) => {
        const s = COVERAGE[c.status];
        return (
          <li key={i} className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 ${s.row}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`size-2 shrink-0 rounded-full ${s.dot}`} aria-hidden />
                <span className="text-sm font-medium text-slate-800">{c.name}</span>
              </div>
              {c.detail && <p className="mt-1 pl-4 text-xs text-slate-500">{c.detail}</p>}
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${s.pill}`}>{s.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

// Encouraging palette: never red.
function pillClass(score: number) {
  if (score >= 80) return "bg-emerald-50 text-emerald-800";
  if (score >= 60) return "bg-brand-100 text-brand-700";
  return "bg-amber-50 text-amber-900";
}

function ScorePill({ score }: { score: number }) {
  return (
    <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${pillClass(score)}`}>
      {Math.round(score)}
      <span className="font-normal opacity-70"> / 100</span>
    </span>
  );
}

export default function SectionCard({ title, result, highlighted }: Props) {
  if (result.status !== "ok") {
    return (
      <section className={`${card} bg-slate-50`}>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">
          {result.status === "error" ? `We couldn't score this part. ${result.error}` : result.reason}
        </p>
      </section>
    );
  }

  const { score, summary, feedback, concepts } = result.data;
  // Unscored sections have nothing else to show, so their feedback is always visible.
  const showFeedback = (highlighted || score === undefined) && feedback.length > 0;
  return (
    <section className={highlighted ? `${card} ring-2 ring-brand-600/40` : card}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {highlighted && (
            <span className="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
              Needs the most work
            </span>
          )}
        </div>
        {score !== undefined && <ScorePill score={score} />}
      </div>
      <p className="mt-2 text-sm text-slate-600">{summary}</p>

      {/* Content section: always show the per-concept covered/not-covered breakdown. */}
      {concepts && concepts.length > 0 && <CoverageList concepts={concepts} />}

      {showFeedback && (
        <ul className="mt-4 space-y-3">
          {feedback.map((f, i) => (
            <li key={i} className="text-sm">
              <p>{f.point}</p>
              {f.quote && (
                <blockquote className="mt-1 border-l-2 border-brand-100 pl-3 text-slate-500 italic">
                  “{f.quote}”
                </blockquote>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
