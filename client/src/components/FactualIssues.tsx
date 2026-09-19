import type { FactualIssue, SectionResult } from "@ta-coach/shared";

interface Props {
  result: SectionResult<FactualIssue[]>;
}

const isHttpUrl = (raw: string) => {
  try {
    const { protocol } = new URL(raw);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

function SourceLine({ issue }: { issue: FactualIssue }) {
  const { label, excerpt, url } = issue.source;
  if (!label && !url) return <p className="mt-2 text-xs text-slate-500">Source: No source provided</p>;
  return (
    <div className="mt-2 text-xs text-slate-500">
      <p>
        Source:{" "}
        {url && isHttpUrl(url) ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-700 underline hover:text-brand-600"
          >
            {label || url}
          </a>
        ) : (
          <span>{label || url}</span>
        )}
      </p>
      {excerpt && <blockquote className="mt-1 border-l-2 border-slate-200 pl-3 italic">“{excerpt}”</blockquote>}
    </div>
  );
}

const LABELS: Record<FactualIssue["basis"], string> = {
  materials: "Contradicts your materials",
  general: "Looks factually wrong",
};

export default function FactualIssues({ result }: Props) {
  // Hidden unless there is something to show; a failed check gets a small inline error instead.
  if (result.status === "skipped" || (result.status === "ok" && result.data.length === 0)) return null;

  if (result.status === "error") {
    return (
      <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {result.error || "We couldn't run the fact check this time."}
      </p>
    );
  }

  return (
    <section aria-labelledby="facts-heading" className="rounded-2xl bg-white p-5 ring-2 ring-red-300">
      <h2 id="facts-heading" className="text-base font-semibold">
        Things to double-check
      </h2>
      <p className="text-sm text-slate-500">A few statements didn't match the facts.</p>
      <ul className="mt-3 space-y-4">
        {result.data.map((issue, i) => (
          <li key={i} className="text-sm">
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
              {LABELS[issue.basis]}
            </span>
            <blockquote className="mt-2 border-l-2 border-red-200 pl-3 text-slate-600 italic">“{issue.quote}”</blockquote>
            <p className="mt-2">{issue.problem}</p>
            <p className="mt-1">
              <span className="font-medium">Correction:</span> {issue.correction}
            </p>
            <SourceLine issue={issue} />
          </li>
        ))}
      </ul>
    </section>
  );
}
