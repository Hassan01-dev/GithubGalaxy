"use client";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";

const DURATION = 900;
const PEAK = 0.5; // fraction of DURATION where the screen is fully covered
const STARS = 260;

let play: ((color: string) => Promise<void>) | null = null;

/**
 * Hyperspace jump. Resolves at the peak (screen covered) so the caller can navigate mid-warp;
 * the fade-out keeps playing over the new page. Instant no-op with reduced motion or no overlay mounted.
 */
export function warpTo(color: string): Promise<void> {
  if (!play || prefersReducedMotion()) return Promise.resolve();
  return play(color);
}

/** Mount once in the root layout; it survives client navigation. */
export function WarpOverlay() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current;
    const g = el?.getContext("2d");
    if (!el || !g) return;
    let raf = 0;
    let peak: (() => void) | null = null;
    const stars = Array.from({ length: STARS }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random(), w: 0.4 + Math.random() }));

    play = (color) =>
      new Promise<void>((resolve) => {
        cancelAnimationFrame(raf);
        peak?.(); // a warp interrupted by another still lets its caller continue
        peak = resolve;
        const dpr = Math.min(2, devicePixelRatio || 1);
        const W = innerWidth, H = innerHeight;
        el.width = W * dpr;
        el.height = H * dpr;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        el.style.display = "block";
        const cx = W / 2, cy = H / 2, max = Math.hypot(cx, cy);
        const t0 = performance.now();
        const frame = (now: number) => {
          const t = Math.min(1, (now - t0) / DURATION);
          // Cover ramps up to the peak, then fades to reveal the new page.
          const cover = t < PEAK ? (t / PEAK) ** 2 : 1 - ((t - PEAK) / (1 - PEAK)) ** 0.7;
          const speed = t < PEAK ? (t / PEAK) ** 3 : 1 - (t - PEAK) / (1 - PEAK);
          g.clearRect(0, 0, W, H);
          g.globalAlpha = cover;
          g.fillStyle = "#04050c";
          g.fillRect(0, 0, W, H);
          const glow = g.createRadialGradient(cx, cy, 0, cx, cy, max * 0.7);
          glow.addColorStop(0, color);
          glow.addColorStop(1, "transparent");
          g.globalAlpha = cover * 0.35;
          g.fillStyle = glow;
          g.fillRect(0, 0, W, H);
          g.globalAlpha = Math.min(1, cover * 1.4);
          g.strokeStyle = color;
          g.lineCap = "round";
          for (const s of stars) {
            // Stars rush outward from the centre; streak length grows with speed.
            const r0 = ((s.r + t * 1.6 * s.w) % 1) ** 2 * max;
            const r1 = r0 + speed * max * 0.35 * s.w * (r0 / max + 0.1);
            const c = Math.cos(s.a), sn = Math.sin(s.a);
            g.lineWidth = 0.6 + s.w * (r0 / max) * 1.8;
            g.beginPath();
            g.moveTo(cx + c * r0, cy + sn * r0);
            g.lineTo(cx + c * r1, cy + sn * r1);
            g.stroke();
          }
          if (t >= PEAK && peak) {
            peak();
            peak = null;
          }
          if (t < 1) raf = requestAnimationFrame(frame);
          else el.style.display = "none";
        };
        raf = requestAnimationFrame(frame);
      });

    return () => {
      cancelAnimationFrame(raf);
      peak?.();
      play = null;
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[100] h-full w-full" style={{ display: "none" }} />;
}
