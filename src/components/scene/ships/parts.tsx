"use client";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

export type V3 = [number, number, number];

/** Painted metal. Moderate metalness: the galaxy has no environment map, so very metallic hulls read black. */
export function Paint({ color, metal = 0.45, rough = 0.38, flat = true }: { color: string; metal?: number; rough?: number; flat?: boolean }) {
  return <meshStandardMaterial color={color} metalness={metal} roughness={rough} flatShading={flat} />;
}

/** Self-lit parts (engines, lamps). Not tone mapped so they stay saturated against the dark. */
export function Lit({ color, intensity = 1.6 }: { color: string; intensity?: number }) {
  return <meshStandardMaterial color="#000000" emissive={color} emissiveIntensity={intensity} toneMapped={false} />;
}

/** Glassy clearcoat canopy: half an ellipsoid, flat side down. */
export function Canopy({ position, scale, tint, rotation }: { position: V3; scale: V3; tint: string; rotation?: V3 }) {
  return (
    <mesh position={position} scale={scale} rotation={rotation}>
      <sphereGeometry args={[1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshPhysicalMaterial color="#0b1526" metalness={0.2} roughness={0.08} clearcoat={1} clearcoatRoughness={0.04} emissive={tint} emissiveIntensity={0.35} />
    </mesh>
  );
}

/** Engine bell with a glowing throat, facing -Z. */
export function Nozzle({ at, r, trim, glow, length = 0.18 }: { at: V3; r: number; trim: string; glow: string; length?: number }) {
  return (
    <group position={at}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, length / 2]}>
        <cylinderGeometry args={[r * 0.85, r, length, 14, 1, true]} />
        <meshStandardMaterial color={trim} metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[0, Math.PI, 0]} position={[0, 0, 0.02]}>
        <circleGeometry args={[r * 0.82, 14]} />
        <Lit color={glow} intensity={2.4} />
      </mesh>
    </group>
  );
}

/** Port red / starboard green tip lights with a short, gentle flash every ~2 s. Starboard is -X when facing +Z. */
export function NavLights({ x, y = 0, z, animate }: { x: number; y?: number; z: number; animate: boolean }) {
  const red = useRef<THREE.MeshStandardMaterial>(null);
  const green = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!animate || !red.current || !green.current) return;
    const k = 0.5 + 2.5 * Math.max(0, Math.sin(clock.elapsedTime * 3)) ** 12;
    red.current.emissiveIntensity = green.current.emissiveIntensity = k;
  });
  return (
    <>
      <mesh position={[x, y, z]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial ref={red} color="#000000" emissive="#ff3b3b" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <mesh position={[-x, y, z]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial ref={green} color="#000000" emissive="#3bff7a" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
    </>
  );
}

/** Lathe profile given as [radius, along-axis] pairs; the mesh is rotated so the axis points +Z. */
export const profile = (pts: [number, number][]) => pts.map(([r, y]) => new THREE.Vector2(r, y));

/** Outline drawn as [x, forward] pairs; with rotation [π/2,0,0] it lies flat and extrudes downward. */
export function outline(pts: [number, number][]) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  return s;
}

export const FLAT: V3 = [Math.PI / 2, 0, 0];
