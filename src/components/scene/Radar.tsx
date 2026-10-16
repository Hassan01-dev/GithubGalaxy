"use client";
import { useEffect, useRef } from "react";
import { languageColor, type PlacedPlanet } from "@/lib/galaxy/layout";
import type { Pose } from "./Flight";

const RANGE = 120;
const SIZE = 156;

/**
 * Top-down radar while flying: ship at the centre, heading up. Drawn ~15 fps straight from the
 * shared flight pose; no React state per frame. Decorative (the HUD names the nearby planet).
 */
export function Radar({ planets, visible, selected, pose, accent }: {
  planets: PlacedPlanet[];
  visible: boolean[];
  selected: number | null;
  pose: React.RefObject<Pose>;
  accent: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const g = el?.getContext("2d");
    if (!el || !g) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    el.width = el.height = SIZE * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = planets.map((p) => languageColor(p.repo.language));
    const half = SIZE / 2, scale = (half - 8) / RANGE;

    const draw = () => {
      const p = pose.current;
      g.clearRect(0, 0, SIZE, SIZE);
      g.fillStyle = "rgba(4,5,12,0.72)";
      g.beginPath();
      g.arc(half, half, half - 1, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(207,214,255,0.14)";
      g.lineWidth = 1;
      for (const k of [1 / 3, 2 / 3, 1]) {
        g.beginPath();
        g.arc(half, half, (half - 8) * k, 0, Math.PI * 2);
        g.stroke();
      }
      // Heading from the pose quaternion: forward = (0,0,1) rotated.
      const { x, y, z, w } = p.quat;
      const fx = 2 * (x * z + w * y), fz = 1 - 2 * (x * x + y * y);
      const len = Math.hypot(fx, fz) || 1, cx = fx / len, cz = fz / len;
      for (let i = 0; i < planets.length; i++) {
        if (!visible[i]) continue;
        const pl = planets[i].position;
        const dx = pl[0] - p.pos.x, dz = pl[2] - p.pos.z;
        if (dx * dx + dz * dz > RANGE * RANGE) continue;
        // Screen right = forward × up; screen up = forward.
        const sx = half + (-dx * cz + dz * cx) * scale, sy = half - (dx * cx + dz * cz) * scale;
        const far = Math.min(1, Math.abs(pl[1] - p.pos.y) / 40); // well above/below: dimmer
        const hot = i === selected || i === p.near;
        g.globalAlpha = hot ? 1 : 0.85 - far * 0.5;
        g.fillStyle = colors[i];
        g.beginPath();
        g.arc(sx, sy, 1.2 + planets[i].radius * 1.1, 0, Math.PI * 2);
        g.fill();
        if (hot) {
          g.strokeStyle = accent;
          g.lineWidth = 1.5;
          g.beginPath();
          g.arc(sx, sy, 5 + planets[i].radius * 1.5, 0, Math.PI * 2);
          g.stroke();
        }
      }
      g.globalAlpha = 1;
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.moveTo(half, half - 6);
      g.lineTo(half - 4, half + 4);
      g.lineTo(half + 4, half + 4);
      g.closePath();
      g.fill();
    };
    draw();
    const id = setInterval(draw, 66);
    return () => clearInterval(id);
  }, [planets, visible, selected, pose, accent]);

  return (
    <canvas
      ref={canvas}
      aria-hidden
      className="pointer-events-none absolute right-4 bottom-4 z-10 rounded-full border border-line"
      style={{ width: SIZE, height: SIZE }}
    />
  );
}
