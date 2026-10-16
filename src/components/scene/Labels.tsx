"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface Label3D {
  key: string;
  position: [number, number, number];
  content: React.ReactNode;
  /** "above": bottom-centre sits on the point. "center": centred on it. */
  anchor?: "above" | "center";
  hidden?: boolean;
}

export type LabelEls = React.RefObject<Map<string, HTMLDivElement>>;
export const useLabelEls = (): LabelEls => useRef(new Map<string, HTMLDivElement>());

const v = new THREE.Vector3();

/**
 * Plain DOM labels over the canvas, positioned by projecting their 3D point each frame.
 * One overlay, no per-label React roots, text stays sharp and accessible to the DOM.
 */
export function LabelLayer({ labels, els }: { labels: Label3D[]; els: LabelEls }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {labels.map((l) => (
        <div
          key={l.key}
          ref={(el) => {
            if (el) els.current.set(l.key, el);
            else els.current.delete(l.key);
          }}
          className="absolute top-0 left-0 will-change-transform"
          style={{ visibility: "hidden" }}
        >
          <div style={{ transform: l.anchor === "center" ? "translate(-50%, -50%)" : "translate(-50%, -100%)" }}>{l.content}</div>
        </div>
      ))}
    </div>
  );
}

/** Lives inside the Canvas; writes transforms directly, never React state. */
export function LabelProjector({ labels, els }: { labels: Label3D[]; els: LabelEls }) {
  const invalidate = useThree((s) => s.invalidate);
  // On-demand rendering (reduced motion) still needs a frame when labels change.
  useEffect(() => invalidate(), [labels, invalidate]);
  useFrame(({ camera, size }) => {
    for (const l of labels) {
      const el = els.current.get(l.key);
      if (!el) continue;
      v.set(...l.position).project(camera);
      const offscreen = v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2;
      el.style.visibility = offscreen || l.hidden ? "hidden" : "visible";
      el.style.transform = `translate3d(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px, 0)`;
    }
  });
  return null;
}
