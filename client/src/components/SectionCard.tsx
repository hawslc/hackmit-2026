import type { SectionResult, SectionReview } from "../types";

interface Props {
  title: string;
  result: SectionResult<SectionReview>;
  /** One of the lowest-scoring sections: shows specific feedback, not just the score. */
  highlighted: boolean;
}

const card = "rounded-2xl bg-white p-5 ring-1 ring-slate-200";

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
          {result.status === "error" ? `We couldn't score this part. ${result.message}` : result.reason}
        </p>
      </section>
    );
  }

  const { score, summary, feedback } = result.data;
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
        <ScorePill score={score} />
      </div>
      <p className="mt-2 text-sm text-slate-600">{summary}</p>

      {highlighted && feedback.length > 0 && (
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
