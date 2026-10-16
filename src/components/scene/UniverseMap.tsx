"use client";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useEnvironment } from "@/hooks/useStores";
import { GALAXIES } from "@/lib/galaxy/galaxies";
import { hash, rng } from "@/lib/galaxy/layout";
import type { Galaxy } from "@/types";
import { warpTo } from "@/components/WarpOverlay";
import { LabelLayer, LabelProjector, useLabelEls, type Label3D } from "./Labels";

type V3 = [number, number, number];

/** Each galaxy gets its own silhouette so they read as different places, not recolours. */
function shape(g: Galaxy, n: number): { pts: V3[]; lines?: V3[] } {
  const r = rng(hash(g.slug));
  const gauss = () => (r() + r() + r() - 1.5) / 1.5;
  const pts: V3[] = [];
  const spiral = (arms: number, twist: number, start: number) => {
    const rad = start + (-Math.log(1 - r() * 0.97) * 3);
    const th = (Math.floor(r() * arms) / arms) * Math.PI * 2 + rad * twist + gauss() * 0.35;
    return [Math.cos(th) * rad, gauss() * 0.4, Math.sin(th) * rad] as V3;
  };
  for (let i = 0; i < n; i++) {
    switch (g.theme.shape) {
      case "spiral": pts.push(spiral(2, 0.55, 0)); break;
      case "barred":
        pts.push(r() < 0.3 ? [gauss() * 4, gauss() * 0.4, gauss() * 0.8] : (() => { const p = spiral(2, 0.5, 3.5); return p; })());
        break;
      case "elliptical": pts.push([gauss() * 6, gauss() * 3.4, gauss() * 4.5]); break;
      case "ring": {
        const th = r() * Math.PI * 2, rad = r() < 0.2 ? Math.abs(gauss()) * 1.6 : 7 + gauss() * 0.9;
        pts.push([Math.cos(th) * rad, gauss() * 0.4, Math.sin(th) * rad]);
        break;
      }
      case "irregular": {
        const k = Math.floor(r() * 4), cx = [[0, 0], [3.5, 2], [-3, 2.5], [1, -3.5]][k];
        pts.push([cx[0] + gauss() * 2, gauss() * 1, cx[1] + gauss() * 2]);
        break;
      }
      case "constellation": pts.push([gauss() * 8, gauss() * 3, gauss() * 8]); break;
    }
  }
  if (g.theme.shape !== "constellation") return { pts };
  // A handful of bright stars joined into a route.
  const stars = Array.from({ length: 9 }, () => [gauss() * 7, gauss() * 2, gauss() * 7] as V3);
  return { pts: [...pts.slice(0, n / 3), ...stars], lines: stars.slice(1).flatMap((s, i) => [stars[i], s]) };
}

// Near-camera, left side stays clear: that is where the headline sits.
const POSITIONS: V3[] = [[0, 0, 0], [-30, 6, -16], [30, -2, -20], [32, -6, 14], [4, 10, -40], [-34, 12, -42]];

function GalaxyCloud({ g, position, count, onOpen, onHover, reducedMotion }: { g: Galaxy; position: V3; count: number; onOpen: (g: Galaxy) => void; onHover: (slug: string | null) => void; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { geometry, lines } = useMemo(() => {
    const { pts, lines } = shape(g, count);
    const core = new THREE.Color(g.theme.core), edge = new THREE.Color(g.theme.accent), c = new THREE.Color();
    const pos = new Float32Array(pts.length * 3), col = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => {
      pos.set(p, i * 3);
      c.copy(core).lerp(edge, Math.min(1, Math.hypot(...p) / 7));
      col.set([c.r, c.g, c.b], i * 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const lg = lines ? new THREE.BufferGeometry().setFromPoints(lines.map((p) => new THREE.Vector3(...p))) : null;
    return { geometry: geo, lines: lg };
  }, [g, count]);
  useLayoutEffect(() => () => (geometry.dispose(), lines?.dispose()), [geometry, lines]);
  const tilt = useMemo(() => [((hash(g.slug) % 60) - 30) * 0.01 + 0.35, 0, ((hash(g.slug) >> 8) % 40) * 0.01] as V3, [g.slug]);

  useFrame((_, dt) => {
    if (group.current && !reducedMotion) group.current.rotation.y += dt * (g.available ? 0.06 : 0.025);
  });

  return (
    <group position={position} rotation={tilt}>
      <group ref={group}>
        <points geometry={geometry} raycast={() => null}>
          <pointsMaterial size={0.2} vertexColors transparent opacity={g.available ? 0.95 : 0.55} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
        </points>
        {lines && (
          <lineSegments geometry={lines} raycast={() => null}>
            <lineBasicMaterial color={g.theme.accent} transparent opacity={0.35} />
          </lineSegments>
        )}
      </group>
      {/* Generous invisible hit target. */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(g.slug);
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => (e.stopPropagation(), e.delta < 6 && onOpen(g))}
      >
        <sphereGeometry args={[9, 12, 8]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function UniverseMap() {
  const env = useEnvironment();
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);
  const labelEls = useLabelEls();
  const labels = useMemo<Label3D[]>(
    () =>
      GALAXIES.map((g, i) => ({
        key: g.slug,
        position: [POSITIONS[i][0], POSITIONS[i][1] - 8.5, POSITIONS[i][2]],
        anchor: "center",
        content: (
          <div className={`text-center whitespace-nowrap transition-opacity ${hovered === g.slug || g.available ? "opacity-100" : "opacity-60"}`}>
            <p className="font-display text-sm font-semibold" style={{ color: g.theme.accent }}>{g.title}</p>
            <p className="text-[0.65rem] text-muted">{g.available ? "Open · click to enter" : "Charting soon"}</p>
          </div>
        ),
      })),
    [hovered],
  );
  return (
    <>
      <Canvas
        className="!absolute inset-0"
        style={{ cursor: hovered ? "pointer" : "grab" }}
        dpr={[1, env.lowEffects ? 1.25 : 1.75]}
        camera={{ position: [0, 26, 62], fov: 50 }}
        frameloop={env.reducedMotion ? "demand" : "always"}
        aria-hidden
      >
        <color attach="background" args={["#04050c"]} />
        {/* No zoom: the page must scroll normally over the hero. */}
        <OrbitControls enableZoom={false} enablePan={false} enableDamping maxPolarAngle={Math.PI * 0.62} minPolarAngle={Math.PI * 0.2} />
        {GALAXIES.map((g, i) => (
          <GalaxyCloud
            key={g.slug}
            g={g}
            position={POSITIONS[i]}
            count={env.lowEffects ? 1200 : 3500}
            reducedMotion={env.reducedMotion}
            onOpen={(x) => void warpTo(x.theme.accent).then(() => router.push(`/galaxy/${x.slug}`))}
            onHover={setHovered}
          />
        ))}
        <LabelProjector labels={labels} els={labelEls} />
      </Canvas>
      <LabelLayer labels={labels} els={labelEls} />
    </>
  );
}
