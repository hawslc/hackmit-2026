import type { SectionResult } from "@ta-coach/shared";
import { isCoreGap } from "../lib/reviewView";
import type { ContentGap } from "../types";

interface Props {
  result: SectionResult<ContentGap[]>;
}

function GapItem({ gap }: { gap: ContentGap }) {
  return (
    <li className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-medium">{gap.concept}</span>
        <span className="text-xs text-slate-500">{gap.status === "partial" ? "Partly covered" : "Not covered"}</span>
      </div>
      {gap.note && <p className="text-xs text-slate-500">{gap.note}</p>}
    </li>
  );
}

export default function ContentGaps({ result }: Props) {
  const gaps = result.status === "ok" ? result.data : [];
  const core = gaps.filter(isCoreGap);
  const other = gaps.filter((g) => !isCoreGap(g));

  return (
    <section aria-labelledby="gaps-heading" className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h2 id="gaps-heading" className="text-base font-semibold">
        Content you didn't cover
      </h2>

      {result.status === "skipped" && <p className="mt-1 text-sm text-slate-500">{result.reason}</p>}
      {result.status === "error" && (
        <p className="mt-1 text-sm text-slate-500">We couldn't check your coverage. {result.error}</p>
      )}
      {result.status === "ok" && gaps.length === 0 && (
        <p className="mt-1 text-sm text-emerald-800">You touched on every concept. Nice work.</p>
      )}

      {core.length > 0 && (
        <div className="mt-2">
          <h3 className="text-sm font-medium text-slate-700">Worth a second look</h3>
          <p className="text-sm text-slate-500">Not covered. Was that intentional?</p>
          <ul className="mt-2 space-y-2">
            {core.map((g) => (
              <GapItem key={g.concept} gap={g} />
            ))}
          </ul>
        </div>
      )}

      {other.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600">
            Also not covered ({other.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {other.map((g) => (
              <GapItem key={g.concept} gap={g} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
