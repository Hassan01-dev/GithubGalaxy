"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { animate, stagger } from "animejs";
import { Sheet } from "./Panels";
import { useEnvironment, useSettings } from "@/hooks/useStores";
import { prefersReducedMotion } from "@/lib/motion";
import { flightOf, getShip, SHIPS, type ShipStats } from "@/lib/ships";
import { settings } from "@/lib/storage/settings";

const Preview = dynamic(() => import("@/components/scene/ships/Preview"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-white/[0.03]" />,
});

const STATS: [keyof ShipStats, string][] = [["speed", "Speed"], ["boost", "Boost"], ["agility", "Agility"]];

function Bars({ value, color, data }: { value: number; color: string; data?: boolean }) {
  return (
    <span className="flex flex-1 gap-1" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} data-seg={data || undefined} className="h-1.5 flex-1 origin-left rounded-full" style={{ background: n <= value ? color : "var(--line-strong)" }} />
      ))}
    </span>
  );
}

/** Pick the ship you fly. Saved in this browser's settings; the galaxy ship and flight handling follow it. */
export function Hangar({ onClose }: { onClose: () => void }) {
  const equipped = getShip(useSettings().ship).id;
  const { reducedMotion } = useEnvironment();
  const [index, setIndex] = useState(() => SHIPS.findIndex((s) => s.id === equipped));
  const [status, setStatus] = useState("");
  const ship = SHIPS[index];
  const glow = ship.palette.glow;
  const flight = flightOf(ship.stats);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const details = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !list.current) return;
    animate(list.current.children, { opacity: [0, 1], translateY: [10, 0], duration: 420, delay: stagger(45), ease: "outCubic" });
  }, []);

  // Re-run on every highlight change so the stat bars fill in for the new ship.
  useEffect(() => {
    if (prefersReducedMotion() || !details.current) return;
    animate(details.current.querySelectorAll("[data-seg]"), { scaleX: [0, 1], duration: 360, delay: stagger(22), ease: "outCubic" });
    animate(details.current.querySelectorAll("[data-fade]"), { opacity: [0, 1], translateX: [8, 0], duration: 320, delay: stagger(40), ease: "outQuad" });
  }, [index]);

  const go = (i: number) => {
    const next = (i + SHIPS.length) % SHIPS.length;
    setIndex(next);
    const el = cards.current[next];
    el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step) go(index + step);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(SHIPS.length - 1);
    else return;
    e.preventDefault();
  };

  const equip = () => {
    settings.set({ ship: ship.id });
    setStatus(`${ship.name} equipped.`);
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Sheet title="Hangar" onClose={onClose} className="max-h-[72vh] w-full max-w-3xl sm:max-h-[88vh]">
        <div className="grid gap-4 sm:grid-cols-[1.15fr_1fr]">
          <div className="relative h-40 overflow-hidden rounded-xl border border-line sm:h-auto sm:min-h-64" style={{ background: `radial-gradient(ellipse at 50% 75%, color-mix(in srgb, ${glow} 16%, transparent), transparent 70%)` }}>
            <Preview id={ship.id} reducedMotion={reducedMotion} />
            {ship.id === equipped && <span className="chip absolute top-2 left-2 !bg-black/40 !text-text">Equipped</span>}
          </div>
          <div ref={details}>
            <h3 data-fade className="font-display text-xl font-semibold">{ship.name}</h3>
            <p data-fade className="text-sm font-medium" style={{ color: glow }}>{ship.tagline}</p>
            <p data-fade className="mt-2 text-sm text-muted">{ship.description}</p>
            <dl className="mt-3 space-y-1.5">
              {STATS.map(([k, label]) => (
                <div key={k} className="flex items-center gap-3">
                  <dt className="w-16 text-xs text-faint">{label}</dt>
                  <dd className="flex flex-1 items-center">
                    <span className="sr-only">{ship.stats[k]} of 5</span>
                    <Bars value={ship.stats[k]} color={glow} data />
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-faint">
              In flight mode: cruise {Math.round(flight.cruise)} · boost {Math.round(flight.boost)} · turn {flight.turn.toFixed(2)} rad/s
            </p>
            <button className="btn btn-primary mt-3 w-full" onClick={equip} disabled={ship.id === equipped}>
              {ship.id === equipped ? "Equipped" : `Select ${ship.name}`}
            </button>
            <p role="status" className="sr-only">{status}</p>
          </div>
        </div>

        <div
          ref={list}
          role="radiogroup"
          aria-label="Ships"
          onKeyDown={onKeyDown}
          className="scroll-thin -mx-4 mt-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0"
        >
          {SHIPS.map((s, i) => (
            <button
              key={s.id}
              ref={(el) => void (cards.current[i] = el)}
              role="radio"
              aria-checked={i === index}
              tabIndex={i === index ? 0 : -1}
              autoFocus={s.id === equipped}
              onClick={() => setIndex(i)}
              className={`glass flex w-40 shrink-0 snap-start flex-col gap-1.5 rounded-xl p-3 text-left transition-colors hover:border-line-strong sm:w-auto ${i === index ? "!border-accent" : ""}`}
              style={i === index ? { borderColor: s.palette.glow } : undefined}
            >
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: s.palette.hull, boxShadow: `0 0 0 2px ${s.palette.glow}` }} />
                <span className="truncate text-sm font-medium">{s.name}</span>
                {s.id === equipped && <span className="ml-auto text-[10px] font-semibold tracking-wide text-positive uppercase">In use</span>}
              </span>
              <span className="truncate text-xs text-muted">{s.tagline}</span>
              <span className="mt-1 flex flex-col gap-1" aria-hidden>
                {STATS.map(([k]) => <Bars key={k} value={s.stats[k]} color={s.palette.glow} />)}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
