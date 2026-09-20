import { useState } from "react";
import type { CoachingCard } from "@cadence/shared";
import { categoryLabel, mmss } from "../lib/cardLabels";

interface Props {
  card: CoachingCard;
  /** `more` cards render collapsed behind a summary; the focus card is always open. */
  collapsible?: boolean;
}

const card = "rounded-2xl bg-white p-5 ring-1 ring-slate-200";

function Body({ data }: { data: CoachingCard }) {
  return (
    <div className="mt-3 space-y-3 text-sm">
      {data.quote && (
        <blockquote className="border-l-2 border-brand-100 pl-3 text-slate-500 italic">
          {`“${data.quote}”`}
          {data.atSec > 0 && <span className="ml-2 not-italic text-slate-400">[{mmss(data.atSec)}]</span>}
        </blockquote>
      )}
      <p className="text-slate-700">{data.whatHappened}</p>
      <p className="text-slate-500">{data.whyItMatters}</p>
      <div className="rounded-xl bg-brand-50 px-4 py-3">
        <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Try instead</p>
        <p className="mt-1 text-slate-800">{data.tryInstead}</p>
      </div>
      <p className="text-slate-600">
        <span className="font-semibold text-slate-700">Practice goal: </span>
        {data.practiceGoal}
      </p>
    </div>
  );
}

export default function CoachingCardView({ card: data, collapsible = false }: Props) {
  const [open, setOpen] = useState(false);
  const label = (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      {categoryLabel[data.category]}
    </span>
  );

  if (!collapsible) {
    return (
      <section className={`${card} ring-2 ring-brand-600/40`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-brand-700">{data.headline}</h2>
          {label}
        </div>
        <Body data={data} />
      </section>
    );
  }

  return (
    <section className={card}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="font-semibold text-slate-800">{data.headline}</span>
        <span className="flex items-center gap-2">
          {label}
          <span className="text-slate-400" aria-hidden>
            {open ? "▾" : "▸"}
          </span>
        </span>
      </button>
      {open && <Body data={data} />}
    </section>
  );
}
