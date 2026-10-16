"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { animate } from "animejs";
import { scoreOf } from "@/lib/discovery/score";
import { full } from "@/lib/format";
import { prefersReducedMotion } from "@/lib/motion";
import { useExplorerLog } from "@/lib/storage/log";

const noop = () => () => {};
const R = 9;
const C = 2 * Math.PI * R;

/** Top-bar rank + XP. Opens the Explorer's Log. */
export function ScoreBadge({ onOpen }: { onOpen: () => void }) {
  // The log's server snapshot is empty, so show a neutral placeholder until hydrated instead of a fake "0 XP".
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const { xp, rank, next, progress } = scoreOf(useExplorerLog());
  const num = useRef<HTMLSpanElement>(null);
  const glint = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);

  // Count up only on changes after mount; the first value is just shown.
  useEffect(() => {
    if (!hydrated) return; // The hydration pass renders the empty server log; don't count up from it.
    const from = shown.current;
    shown.current = xp;
    if (from == null || from === xp || prefersReducedMotion()) return;
    const text = num.current?.firstChild; // React's own text node, so later re-renders still land.
    const o = { n: from };
    if (text) animate(o, { n: xp, duration: 800, ease: "outExpo", onUpdate: () => void (text.nodeValue = full(Math.round(o.n))) });
    if (xp > from && glint.current) animate(glint.current, { translateX: ["-120%", "120%"], opacity: [0.9, 0], duration: 700, ease: "outQuad" });
  }, [xp, hydrated]);

  const label = hydrated
    ? `${rank.name} · ${full(xp)} XP${next ? ` · ${Math.floor(progress * 100)}% to ${next.name}` : " · top rank"}`
    : "Explorer's Log";

  return (
    <button className="btn relative !min-h-9 !gap-1.5 overflow-hidden !px-2.5 text-xs" onClick={onOpen} aria-label={label} title={label}>
      <span ref={glint} aria-hidden className="pointer-events-none absolute inset-0 opacity-0" style={{ background: "linear-gradient(100deg, transparent 30%, color-mix(in srgb, var(--accent) 40%, transparent), transparent 70%)" }} />
      <svg viewBox="0 0 24 24" className="size-5 -rotate-90" aria-hidden>
        <circle cx="12" cy="12" r={R} fill="none" stroke="var(--line-strong)" strokeWidth="2" />
        <circle
          cx="12" cy="12" r={R} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - (hydrated ? progress : 0))} className="transition-[stroke-dashoffset] duration-700"
        />
        <text x="12" y="12" transform="rotate(90 12 12)" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="var(--accent)">{hydrated ? rank.emblem : "◇"}</text>
      </svg>
      <span ref={num} className="font-mono tabular-nums">{hydrated ? full(xp) : "—"}</span>
      <span className="text-faint">XP</span>
    </button>
  );
}
