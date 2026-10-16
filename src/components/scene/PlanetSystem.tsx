"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { hash, rng, type PlacedPlanet } from "@/lib/galaxy/layout";
import { populationLights, recentActivity, satelliteOrbits, type SatelliteOrbit } from "@/lib/galaxy/systems";
import type { PlanetScan } from "@/types";
import { Cloud, useGlow, type CloudData } from "./Backdrop";
import { PlanetDetail } from "./PlanetDetail";

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const qa = new THREE.Quaternion();
const v = new THREE.Vector3();
const s = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
const RING_SEGMENTS = 64;

/** Releases from the last year as small satellites on seeded, tilted orbits. */
function Satellites({ orbits, r, reducedMotion }: { orbits: SatelliteOrbit[]; r: number; reducedMotion: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((st) => st.invalidate);
  const { geometry, material, rings, tilts } = useMemo(() => {
    // Body + solar-panel wings, one geometry, one draw call for all satellites.
    const body = new THREE.BoxGeometry(1, 1, 1.4);
    const wings = new THREE.BoxGeometry(4.2, 0.08, 0.9);
    const geometry = mergeGeometries([body, wings])!;
    body.dispose();
    wings.dispose();
    const material = new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.4, flatShading: true });
    const tilts = orbits.map((o) => new THREE.Quaternion().setFromEuler(new THREE.Euler(o.tiltX, 0, o.tiltZ)));
    const pos = new Float32Array(orbits.length * RING_SEGMENTS * 6);
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    orbits.forEach((o, k) => {
      for (let i = 0; i < RING_SEGMENTS; i++) {
        const t0 = (i / RING_SEGMENTS) * Math.PI * 2, t1 = ((i + 1) / RING_SEGMENTS) * Math.PI * 2;
        a.set(Math.cos(t0), 0, Math.sin(t0)).multiplyScalar(o.radius * r).applyQuaternion(tilts[k]);
        b.set(Math.cos(t1), 0, Math.sin(t1)).multiplyScalar(o.radius * r).applyQuaternion(tilts[k]);
        pos.set([a.x, a.y, a.z, b.x, b.y, b.z], (k * RING_SEGMENTS + i) * 6);
      }
    });
    const rings = new THREE.BufferGeometry();
    rings.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { geometry, material, rings, tilts };
  }, [orbits, r]);
  useLayoutEffect(() => () => (geometry.dispose(), material.dispose(), rings.dispose()), [geometry, material, rings]);

  const size = 0.07 + r * 0.035;
  const place = (time: number) => {
    const inst = mesh.current;
    if (!inst) return;
    orbits.forEach((o, i) => {
      const a = o.phase + time * o.speed;
      v.set(Math.cos(a), 0, Math.sin(a)).multiplyScalar(o.radius * r).applyQuaternion(tilts[i]);
      // Wings stay tangent to the orbit.
      q.copy(tilts[i]).multiply(qa.setFromAxisAngle(Y, -a));
      inst.setMatrixAt(i, m.compose(v, q, s.setScalar(size)));
    });
    inst.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    const inst = mesh.current;
    if (!inst) return;
    const c = new THREE.Color();
    // Newest release is a touch brighter.
    orbits.forEach((o, i) => inst.setColorAt(i, c.setScalar(o.newest ? 1 : 0.6)));
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    place(0);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orbits, geometry, invalidate]);

  useFrame(({ clock }) => {
    if (!reducedMotion) place(clock.elapsedTime);
  });

  return (
    <>
      <instancedMesh key={orbits.length} ref={mesh} args={[geometry, material, orbits.length]} frustumCulled={false} raycast={() => null} />
      <lineSegments geometry={rings} raycast={() => null}>
        <lineBasicMaterial color="#cfd6ff" transparent opacity={0.12} depthWrite={false} />
      </lineSegments>
    </>
  );
}

/** Contributors as city lights scattered over the planet's night side (away from the core). */
function Population({ planet, count }: { planet: PlacedPlanet; count: number }) {
  const data = useMemo<CloudData>(() => {
    const r = planet.radius, rand = rng(hash(planet.repo.fullName + ":city"));
    // The core (origin) is the light, so the night side faces away from it: along +position.
    const night = new THREE.Vector3(...planet.position);
    if (night.lengthSq() < 1e-6) night.set(0, 0, 1);
    night.normalize();
    const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
    const centres = Array.from({ length: 7 }, () => new THREE.Vector3(gauss(), gauss(), gauss()).normalize().addScaledVector(night, 0.9).normalize());
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count);
    const u = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      u.copy(centres[i % centres.length]).add(v.set(gauss(), gauss(), gauss()).multiplyScalar(0.3)).normalize();
      const d = u.dot(night);
      if (d < 0) u.addScaledVector(night, -2 * d); // mirror onto the night hemisphere
      u.multiplyScalar(r * 1.015);
      pos.set([u.x, u.y, u.z], i * 3);
      const k = 0.55 + rand() * 0.45;
      col.set([1 * k, 0.78 * k, 0.48 * k], i * 3);
      size[i] = (0.035 + rand() * 0.04) * (0.6 + r * 0.4);
    }
    return { pos, col, size };
  }, [planet, count]);
  return <Cloud data={data} twinkle={0.2} />;
}

/** A latitude ring sweeping pole to pole while the planet is being scanned. */
function ScanSweep({ r, accent, reducedMotion }: { r: number; accent: string; reducedMotion: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  const R = r * 1.08;
  useFrame(({ clock }) => {
    const g = ring.current;
    if (!g || reducedMotion) return;
    const y = Math.sin(clock.elapsedTime * 2.2) * R * 0.97;
    g.position.y = y;
    g.scale.setScalar(Math.sqrt(R * R - y * y));
  });
  return (
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} scale={R} raycast={() => null}>
      <ringGeometry args={[0.94, 1, 64]} />
      <meshBasicMaterial color={accent} transparent opacity={0.75} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

/**
 * The selected planet's system: a high-detail planet, selection ring + glow (pulsing with recent commit activity),
 * release satellites, contributor city lights, and a scan sweep while data loads.
 */
export function PlanetSystem({ planet, accent, reducedMotion, lowEffects, scan, scanning }: {
  planet: PlacedPlanet;
  accent: string;
  reducedMotion: boolean;
  lowEffects: boolean;
  scan: PlanetScan | null;
  scanning: boolean;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const glow = useRef<THREE.SpriteMaterial>(null);
  const tex = useGlow();
  // A scan for another repo (stale while the next one loads) must not decorate this planet.
  const own = scan?.fullName.toLowerCase() === planet.repo.fullName.toLowerCase() ? scan : null;
  const releases = own?.releases;
  const orbits = useMemo(() => satelliteOrbits(releases ?? []).slice(0, lowEffects ? 4 : 8), [releases, lowEffects]);
  const lights = Math.round(populationLights(own?.contributorsCount ?? null) * (lowEffects ? 0.5 : 1));
  const activity = recentActivity(own?.weeklyCommits ?? null);

  useFrame(({ clock }, dt) => {
    if (reducedMotion) return;
    if (ring.current) ring.current.rotation.z += dt * 0.4;
    if (activity > 0 && glow.current && ringMat.current) {
      // Subtle: a busy month breathes a little more, a quiet one barely at all.
      const p = activity * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.4));
      glow.current.opacity = 0.28 + p * 0.16;
      ringMat.current.opacity = 0.85 - activity * 0.25 + p * 0.25;
    }
  });

  const r = planet.radius;
  return (
    <group position={planet.position}>
      <PlanetDetail planet={planet} reducedMotion={reducedMotion} lowEffects={lowEffects} />
      <mesh ref={ring} rotation={[Math.PI / 2.4, 0, 0]} raycast={() => null}>
        <torusGeometry args={[r * 1.55, 0.04 + r * 0.015, 8, 96]} />
        <meshBasicMaterial ref={ringMat} color={accent} transparent opacity={0.85} />
      </mesh>
      <sprite scale={r * 4.2} raycast={() => null}>
        <spriteMaterial ref={glow} map={tex} color={accent} transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {orbits.length > 0 && <Satellites orbits={orbits} r={r} reducedMotion={reducedMotion} />}
      {lights > 0 && <Population planet={planet} count={lights} />}
      {scanning && <ScanSweep r={r} accent={accent} reducedMotion={reducedMotion} />}
    </group>
  );
}
