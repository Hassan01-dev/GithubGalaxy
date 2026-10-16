"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/explorer/Panels";
import { compact, date, full } from "@/lib/format";
import { languageColor } from "@/lib/galaxy/layout";
import { compare, useCompare } from "@/lib/storage/compare";
import type { Repository } from "@/types";

/** Floating tray of planets picked for comparison. Renders nothing while empty. */
export function CompareTray() {
  const items = useCompare();
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <>
      <div role="region" aria-label="Compare tray" className="glass pointer-events-auto fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-2xl p-2 shadow-2xl">
        <ul className="flex min-w-0 gap-1.5 overflow-x-auto scroll-thin">
          {items.map((r) => (
            <li key={r.fullName} className="chip shrink-0 !pr-1">
              <span className="size-2 rounded-full" style={{ background: languageColor(r.language) }} />
              <span className="max-w-32 truncate">{r.fullName}</span>
              <button className="rounded-full p-1 hover:text-text" aria-label={`Remove ${r.fullName} from compare`} onClick={() => compare.remove(r.fullName)}>
                <Icon name="x" className="size-3" />
              </button>
            </li>
          ))}
        </ul>
        <button className="btn btn-primary !min-h-9 shrink-0" onClick={() => setOpen(true)} disabled={items.length < 2} title={items.length < 2 ? "Add one more planet to compare" : undefined}>
          Compare{items.length < 2 ? " (add 1 more)" : ` ${items.length}`}
        </button>
      </div>
      {open && items.length > 1 && <CompareSheet items={items} onClose={() => setOpen(false)} />}
    </>
  );
}

type Row = { label: string; note?: string; value: (r: Repository) => React.ReactNode; best?: (r: Repository) => number };

const ROWS: Row[] = [
  { label: "Stars", value: (r) => full(r.stars), best: (r) => r.stars },
  { label: "Forks", value: (r) => full(r.forks), best: (r) => r.forks },
  // GitHub's open_issues_count includes open pull requests; more isn't better or worse, so no highlight.
  { label: "Open issues + PRs", note: "GitHub counts open pull requests here too", value: (r) => full(r.openIssues) },
  { label: "Language", value: (r) => r.language ?? <span className="text-faint">Not detected</span> },
  { label: "License", value: (r) => r.license ?? <span className="text-caution">None detected</span> },
  { label: "Created", value: (r) => date(r.createdAt) },
  { label: "Last push", value: (r) => date(r.pushedAt), best: (r) => Date.parse(r.pushedAt) },
  { label: "Latest release", value: (r) => (r.latestRelease ? `${r.latestRelease.tag} · ${date(r.latestRelease.publishedAt)}` : <span className="text-faint">None published</span>) },
  { label: "Topics", value: (r) => (r.topics.length ? <span className="flex flex-wrap gap-1">{r.topics.slice(0, 8).map((t) => <span key={t} className="chip">{t}</span>)}</span> : <span className="text-faint">None</span>) },
  { label: "Description", value: (r) => r.description ?? <span className="text-faint">No description</span> },
];

function CompareSheet({ items, onClose }: { items: Repository[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Highest value per row, only when values actually differ.
  const top = ROWS.map((row) => {
    if (!row.best) return null;
    const vals = items.map(row.best);
    return Math.min(...vals) === Math.max(...vals) ? null : Math.max(...vals);
  });

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-3 sm:p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Sheet title="Compare planets" onClose={onClose} className="max-h-[90vh] w-full max-w-5xl">
        <p className="mb-3 text-xs text-faint">
          Side by side from GitHub&apos;s public metadata. <strong className="text-muted">Highlighted</strong> = highest number in that row, not the better project: stars measure attention, not quality.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ "--n": items.length } as React.CSSProperties}>
          {items.map((r) => (
            <article key={r.fullName} className="min-w-0 rounded-xl border border-line p-3">
              <header className="mb-2 flex items-start gap-2">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: languageColor(r.language) }} />
                <h3 className="min-w-0 flex-1 break-words font-display text-sm font-semibold">{r.fullName}</h3>
                <button className="btn btn-icon !min-h-8 !w-8 shrink-0" aria-label={`Remove ${r.fullName} from compare`} onClick={() => compare.remove(r.fullName)}>
                  <Icon name="x" className="size-3.5" />
                </button>
              </header>
              <dl className="divide-y divide-line text-sm">
                {ROWS.map((row, i) => {
                  const hi = top[i] != null && row.best!(r) === top[i];
                  return (
                    <div key={row.label} className="py-1.5">
                      <dt className="label" title={row.note}>{row.label}</dt>
                      <dd className={`mt-0.5 ${hi ? "font-semibold text-accent" : ""}`}>
                        {row.value(r)}
                        {hi && <span className="sr-only"> (highest)</span>}
                        {row.note && <span className="block text-xs text-faint">{row.note}</span>}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <a className="btn mt-3 w-full" href={r.htmlUrl} target="_blank" rel="noopener noreferrer">
                <Icon name="external" /> Open on GitHub <span className="sr-only">({r.fullName})</span>
              </a>
              {r.starGrowth && r.starGrowth.gained > 0 && <p className="mt-2 text-xs text-positive">+{compact(r.starGrowth.gained)} stars since {r.starGrowth.since} (measured)</p>}
            </article>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
