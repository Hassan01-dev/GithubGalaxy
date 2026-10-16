"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { animate } from "animejs";
import { Icon } from "@/components/ui/Icon";
import { prefersReducedMotion } from "@/lib/motion";

export type ToastTone = "achievement" | "rank" | "mission" | "info";
export interface ToastInput { title: string; body?: string; icon?: string; tone?: ToastTone }
export interface ToastItem extends ToastInput { id: number }

const MAX = 3;
const LIFETIME = 5000;
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const EMPTY: ToastItem[] = [];

/** Module-level bus: anything (stores included) can announce without React context. */
export const toast = {
  show(t: ToastInput): number {
    const id = nextId++;
    items = [...items, { ...t, id }].slice(-MAX);
    emit();
    return id;
  },
  dismiss(id: number) {
    items = items.filter((t) => t.id !== id);
    emit();
  },
  get: () => items,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};

const TONE: Record<ToastTone, { color: string; label: string }> = {
  achievement: { color: "var(--accent)", label: "Achievement unlocked" },
  rank: { color: "var(--accent)", label: "Rank up" },
  mission: { color: "var(--positive)", label: "Mission complete" },
  info: { color: "var(--muted)", label: "Note" },
};

function Toast({ t }: { t: ToastItem }) {
  const el = useRef<HTMLDivElement>(null);
  const sweep = useRef<HTMLSpanElement>(null);
  const tone = TONE[t.tone ?? "info"];

  useEffect(() => {
    const node = el.current!;
    const still = prefersReducedMotion();
    if (!still) {
      animate(node, { opacity: [0, 1], translateX: [24, 0], scale: [0.92, 1], duration: 520, ease: "outBack(1.4)" });
      if (t.tone !== "info") animate(sweep.current!, { translateX: ["-120%", "120%"], opacity: [0.9, 0], duration: 900, delay: 180, ease: "outQuad" });
    }
    const timer = setTimeout(() => {
      if (still) return toast.dismiss(t.id);
      animate(node, { opacity: 0, translateX: 24, scale: 0.96, duration: 260, ease: "inQuad", onComplete: () => toast.dismiss(t.id) });
    }, LIFETIME);
    return () => clearTimeout(timer);
  }, [t.id, t.tone]);

  return (
    <div
      ref={el}
      className="glass pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-xl p-3 pr-2 shadow-2xl"
      style={{ borderColor: `color-mix(in srgb, ${tone.color} 45%, transparent)`, boxShadow: `0 0 24px -8px ${tone.color}` }}
    >
      <span ref={sweep} aria-hidden className="pointer-events-none absolute inset-0 opacity-0" style={{ background: `linear-gradient(100deg, transparent 30%, color-mix(in srgb, ${tone.color} 35%, transparent), transparent 70%)` }} />
      {t.icon && <span aria-hidden className="text-xl leading-none">{t.icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="label" style={{ color: tone.color }}>{tone.label}</p>
        <p className="font-display text-sm font-semibold">{t.title}</p>
        {t.body && <p className="text-xs text-muted">{t.body}</p>}
      </div>
      <button className="btn btn-icon !min-h-8 !w-8 shrink-0 !border-transparent !bg-transparent" aria-label={`Dismiss: ${t.title}`} onClick={() => toast.dismiss(t.id)}>
        <Icon name="x" className="size-3.5" />
      </button>
    </div>
  );
}

/** Mount once in the root layout. */
export function Toasts() {
  const list = useSyncExternalStore(toast.subscribe, toast.get, () => EMPTY);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-24 z-50 flex flex-col items-center gap-2 px-4 md:left-auto md:right-4 md:items-end md:px-0">
      {list.map((t) => <Toast key={t.id} t={t} />)}
    </div>
  );
}
