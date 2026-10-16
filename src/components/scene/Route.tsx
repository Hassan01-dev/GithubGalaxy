"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PlacedPlanet } from "@/lib/galaxy/layout";
import { useGlow } from "./Backdrop";

const SAMPLES_PER_LEG = 48;

/** A journey: a smooth path through its stops with lights flowing along it, the active stop highlighted. */
export function Route({ planets, indices, active, accent, reducedMotion, lowEffects }: {
  planets: PlacedPlanet[];
  indices: number[];
  active: number | null;
  accent: string;
  reducedMotion: boolean;
  lowEffects: boolean;
}) {
  const tex = useGlow();
  const lights = useRef<THREE.Points>(null);
  const halo = useRef<THREE.Sprite>(null);
  const invalidate = useThree((st) => st.invalidate);
  const stops = useMemo(() => indices.filter((i) => planets[i]).map((i) => planets[i]), [planets, indices]);

  const { line, samples, flow, count, dots } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(stops.map((p) => new THREE.Vector3(...p.position)), false, "centripetal");
    const n = Math.max(2, (stops.length - 1) * SAMPLES_PER_LEG);
    const pts = curve.getSpacedPoints(n);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    line.raycast = () => null;
    const dots = new Float32Array(stops.flatMap((p) => p.position));
    const samples = new Float32Array(pts.flatMap((p) => [p.x, p.y, p.z]));
    const count = Math.min(lowEffects ? 24 : 60, (stops.length - 1) * 8);
    return { line, samples, flow: new Float32Array(count * 3), count, dots };
  }, [stops, lowEffects]);
  useLayoutEffect(() => () => (line.geometry.dispose(), line.material.dispose()), [line]);

  // Lights at evenly spaced fractions of the path, all moving forward together.
  const place = (offset: number) => {
    const attr = lights.current?.geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (!attr) return;
    const arr = attr.array as Float32Array, last = samples.length / 3 - 1;
    for (let k = 0; k < count; k++) {
      const f = (((k / count + offset) % 1) + 1) % 1 * last;
      const i = Math.floor(f), t = f - i, j = Math.min(last, i + 1);
      for (let c = 0; c < 3; c++) arr[k * 3 + c] = samples[i * 3 + c] + (samples[j * 3 + c] - samples[i * 3 + c]) * t;
    }
    attr.needsUpdate = true;
  };
  useLayoutEffect(() => {
    place(0);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, count, invalidate]);

  const legs = Math.max(1, stops.length - 1);
  useFrame(({ clock }) => {
    if (reducedMotion) return;
    // Constant speed per leg regardless of how long the journey is.
    place((clock.elapsedTime * 0.12) / legs);
    if (halo.current) halo.current.scale.setScalar(halo.current.userData.base * (1 + 0.12 * Math.sin(clock.elapsedTime * 2.5)));
  });

  if (stops.length < 2) return null;
  const current = active != null ? planets[indices[active]] : null;
  return (
    <>
      <primitive object={line} material-color={accent} />
      <points ref={lights} raycast={() => null} frustumCulled={false} key={count}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[flow, 3]} />
        </bufferGeometry>
        <pointsMaterial map={tex} color={accent} size={1.1} transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <points raycast={() => null} key={`d${dots.length}`}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dots, 3]} />
        </bufferGeometry>
        <pointsMaterial map={tex} color={accent} size={4} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      {current && (
        <sprite ref={halo} key={`active:${current.repo.id}`} position={current.position} scale={current.radius * 6 + 2} userData={{ base: current.radius * 6 + 2 }} raycast={() => null}>
          <spriteMaterial map={tex} color="#ffffff" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      )}
    </>
  );
}
