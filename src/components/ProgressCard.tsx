"use client";
import Link from "next/link";
import { Ago } from "@/components/ui/Ago";
import { scoreOf } from "@/lib/discovery/score";
import { full } from "@/lib/format";
import { getGalaxy } from "@/lib/galaxy/galaxies";
import { useExplorerLog } from "@/lib/storage/log";

/** Landing-page "welcome back". The log's server snapshot is empty, so SSR and hydration render nothing: no flash, no mismatch. */
export function ProgressCard() {
  const log = useExplorerLog();
  const { xp, rank, next, progress } = scoreOf(log);
  if (!xp) return null;
  const recent = log.visits[0]?.galaxy;
  const galaxy = recent ? getGalaxy(recent) : undefined;
  const lastVisit = log.previousVisitAt ?? log.visits[0]?.at;

  return (
    <section aria-labelledby="progress-card" className="glass mx-auto w-full max-w-md rounded-2xl p-4 text-left shadow-2xl">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full border border-accent/50 text-xl text-accent">{rank.emblem}</span>
        <div className="min-w-0 flex-1">
          <h2 id="progress-card" className="font-display text-base font-semibold">Welcome back, {rank.name}</h2>
          <p className="text-xs text-muted">
            {full(log.visits.length)} planet{log.visits.length === 1 ? "" : "s"} visited
            {lastVisit && <> · last visit <Ago iso={lastVisit} /></>}
          </p>
        </div>
        <p className="shrink-0 text-right font-mono text-lg text-accent">{full(xp)}<span className="label ml-1">XP</span></p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={next ? `Progress to ${next.name}` : "Top rank reached"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(progress * 100)}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-faint">{next ? `${full(next.min - xp)} XP to ${next.name}` : "Top rank reached"}</span>
        {galaxy && <Link className="btn btn-primary !min-h-9 text-xs" href={`/galaxy/${galaxy.slug}`}>Continue exploring {galaxy.title}</Link>}
      </div>
    </section>
  );
}
