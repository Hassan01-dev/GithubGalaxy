"use client";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { animate, stagger } from "animejs";
import { dateKey, evaluateMission, missionFor } from "@/lib/discovery/missions";
import { prefersReducedMotion } from "@/lib/motion";
import { explorerLog, useExplorerLog } from "@/lib/storage/log";
import type { GalaxyRegion, Repository } from "@/types";

const noop = () => () => {};
const SPARKS = 10;

/** Today's mission for this galaxy. Client-only: the day is the visitor's local day. */
export function MissionChip({ galaxy, repos, regions }: { galaxy: string; repos: Repository[]; regions: GalaxyRegion[] }) {
  const today = useSyncExternalStore(noop, () => dateKey(), () => null);
  const mission = useMemo(() => (today ? missionFor(today, galaxy, repos, regions) : null), [today, galaxy, repos, regions]);
  const log = useExplorerLog();
  const [open, setOpen] = useState(false);
  const id = useId();
  const sparks = useRef<HTMLSpanElement>(null);
  const wasDone = useRef<boolean | null>(null);
  const state = mission ? evaluateMission(mission, log.visits) : null;
  const done = !!state?.done;

  useEffect(() => {
    explorerLog.trackMission(mission);
    return () => explorerLog.trackMission(null);
  }, [mission]);

  // Celebrate only the moment it flips to done in this session, not every time the chip mounts already complete.
  useEffect(() => {
    const flipped = wasDone.current === false && done;
    wasDone.current = done;
    if (!flipped || prefersReducedMotion() || !sparks.current) return;
    const els = sparks.current.children;
    animate(els, {
      opacity: [1, 0],
      scale: [1, 0.3],
      translateX: (_: unknown, i = 0) => Math.cos((i / SPARKS) * Math.PI * 2) * 34,
      translateY: (_: unknown, i = 0) => Math.sin((i / SPARKS) * Math.PI * 2) * 22,
      duration: 900,
      delay: stagger(20),
      ease: "outCubic",
    });
  }, [done]);

  if (!mission || !state) return null;
  return (
    <div className="pointer-events-auto relative">
      <button
        className={`btn !min-h-9 max-w-[min(22rem,80vw)] !gap-2 !px-3 text-xs ${done ? "!border-positive/60" : ""}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden className={done ? "text-positive" : "text-accent"}>{done ? "✓" : "◎"}</span>
        <span className="truncate"><span className="text-faint">Today&apos;s mission:</span> {mission.title}</span>
        <span className="font-mono text-faint">{state.progress}/{state.target}</span>
        <span ref={sparks} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
          {Array.from({ length: SPARKS }, (_, i) => (
            <span key={i} className="absolute size-1.5 rounded-full opacity-0" style={{ background: i % 2 ? "var(--positive)" : "var(--accent)" }} />
          ))}
        </span>
      </button>
      {open && (
        <div id={id} className="glass absolute left-0 top-full z-20 mt-2 w-[min(22rem,90vw)] rounded-xl p-4 shadow-2xl">
          <p className="label">Today&apos;s mission</p>
          <p className="mt-1 font-display text-sm font-semibold">{mission.title}</p>
          <p className="mt-1 text-sm text-muted">{mission.rule}</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Mission progress" aria-valuemin={0} aria-valuemax={state.target} aria-valuenow={state.progress}>
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(state.progress / state.target) * 100}%`, background: done ? "var(--positive)" : "var(--accent)" }} />
            </div>
            <span className="font-mono text-xs text-muted">{done ? "Done ✓" : `${state.progress}/${state.target}`}</span>
          </div>
          <p className="mt-3 text-xs text-faint">Missions use only data shown in the galaxy. New one tomorrow.</p>
        </div>
      )}
    </div>
  );
}
