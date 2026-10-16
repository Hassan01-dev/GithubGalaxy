"use client";
import { animate } from "animejs";
import { useEffect, useRef } from "react";
import { CopyLinkButton } from "@/components/explorer/RepoDetails";
import { Icon } from "@/components/ui/Icon";
import type { Journey } from "@/lib/discovery/journeys";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Guided-journey card. `stopIndex === stops.length` is the finish state.
 * Stops missing from the loaded galaxy (`available` false) stay listed but are stepped over by Next/Skip.
 */
export function JourneyHud({ journey, stopIndex, available, onGo, onExit }: {
  journey: Journey;
  stopIndex: number;
  available: (fullName: string) => boolean;
  onGo: (i: number) => void;
  onExit: () => void;
}) {
  const { stops } = journey;
  const done = stopIndex >= stops.length;
  const stop = done ? null : stops[Math.max(0, stopIndex)];
  const here = stop != null && available(stop.fullName);
  /** First available stop after `i`, or the finish. */
  const nextFrom = (i: number) => {
    for (let k = i + 1; k < stops.length; k++) if (available(stops[k].fullName)) return k;
    return stops.length;
  };
  const prevFrom = (i: number) => {
    for (let k = Math.min(i, stops.length) - 1; k >= 0; k--) if (available(stops[k].fullName)) return k;
    return -1;
  };
  const next = nextFrom(stopIndex), prev = prevFrom(stopIndex);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!body.current || prefersReducedMotion()) return;
    const a = animate(body.current, { opacity: [0, 1], translateY: [10, 0], duration: 420, ease: "outQuad" });
    return () => void a.revert();
  }, [stopIndex]);

  return (
    <section
      aria-label={`Editorial journey: ${journey.title}`}
      className="glass pointer-events-auto mx-auto w-[min(34rem,calc(100vw-1.5rem))] rounded-2xl p-3 shadow-2xl sm:p-4"
      style={journey.accent ? ({ "--accent": journey.accent } as React.CSSProperties) : undefined}
    >
      <header className="flex items-center gap-2">
        <span className="chip !border-accent/50 !text-accent" title="Hand-picked by the Open Source Galaxy editors, not an algorithm">Editorial journey</span>
        <h2 className="min-w-0 flex-1 truncate font-display text-sm font-semibold">{journey.title}</h2>
        <CopyLinkButton path={`/journeys/${journey.slug}`} label="Share" />
        <button className="btn btn-icon" onClick={onExit} aria-label="Leave journey">
          <Icon name="x" />
        </button>
      </header>

      <div ref={body} aria-live="polite" className="mt-2 sm:mt-3">
        {stop ? (
          <>
            <p className="label">
              Stop {stopIndex + 1} of {stops.length}
            </p>
            <p className="mt-0.5 truncate font-mono text-sm text-text">{stop.fullName}</p>
            {/* Clamped on phones so the card stays compact above the bottom controls. */}
            <p className="mt-1 line-clamp-2 text-sm text-muted sm:line-clamp-none">{stop.note}</p>
            {!here && <p className="mt-1 text-xs text-caution">Not in this snapshot of the galaxy. Skip ahead, or open it on its own page.</p>}
          </>
        ) : (
          <>
            <p className="label !text-accent">Journey complete</p>
            <p className="mt-1 text-sm text-muted">You visited all {stops.length} stops. Share the route, or fly it again.</p>
          </>
        )}
      </div>

      <ol className="mt-3 flex items-center gap-1.5" aria-label="Stops">
        {stops.map((s, i) => (
          <li key={s.fullName}>
            <button
              onClick={() => onGo(i)}
              aria-label={`Stop ${i + 1}: ${s.fullName}`}
              aria-current={i === stopIndex ? "step" : undefined}
              className={`block size-2.5 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                i === stopIndex ? "bg-accent" : i < stopIndex ? "bg-accent/45" : "bg-line-strong"
              } ${available(s.fullName) ? "" : "opacity-40"}`}
            />
          </li>
        ))}
      </ol>

      <div className="mt-3 flex flex-wrap gap-2">
        {done ? (
          <button className="btn btn-primary" onClick={() => onGo(nextFrom(-1))}>
            <Icon name="home" /> Restart journey
          </button>
        ) : (
          <>
            <button className="btn" onClick={() => onGo(prev)} disabled={prev < 0}>
              Prev
            </button>
            <button className="btn btn-primary" onClick={() => onGo(next)}>
              {next >= stops.length ? "Finish" : "Next stop"}
            </button>
            {/* Skip passes over the upcoming stop without visiting it. */}
            <button className="btn" onClick={() => onGo(nextFrom(next))} disabled={next >= stops.length} aria-label="Skip the next stop">
              Skip
            </button>
          </>
        )}
      </div>
    </section>
  );
}
