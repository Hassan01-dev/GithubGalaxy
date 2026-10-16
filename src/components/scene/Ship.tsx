"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGlow } from "./Backdrop";
import type { Pose } from "./Flight";
import { ShipModel } from "./ships";
import { useSettings } from "@/hooks/useStores";
import { getShip } from "@/lib/ships";

const SCALE = 0.9;
const fwd = new THREE.Vector3(0, 0, 1);
const tmp = new THREE.Vector3();
const vel = new THREE.Vector3();
const qTarget = new THREE.Quaternion();

/**
 * The traveller's marker. It eases toward `target` (a planet you picked, or the
 * view's centre) with capped speed. No physics, no roll, no shake.
 * The model, glow and exhaust come from the ship chosen in the hangar; `accent` is no longer used.
 */
export function Ship({ target, pose, reducedMotion }: { target: React.RefObject<THREE.Vector3>; pose: React.RefObject<Pose>; accent?: string; reducedMotion: boolean }) {
  const ship = getShip(useSettings().ship);
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Group>(null);
  const tex = useGlow();
  const trail = useRef<THREE.Points>(null);
  const nozzles = ship.exhaust.length;
  // One Points buffer for all nozzles: each frame shifts by `nozzles` and writes one point per nozzle.
  const trailInit = useMemo(() => new Float32Array(ship.trail.length * nozzles * 3), [ship.trail.length, nozzles]);
  const started = useRef(false);

  useFrame((_, rawDt) => {
    const g = group.current;
    if (!g || !target.current) return;
    const dt = Math.min(rawDt, 0.05);
    const p = pose.current;
    if (p.active) {
      // Flight mode drives the ship directly.
      g.position.copy(p.pos);
      g.quaternion.copy(p.quat);
    } else if (!started.current || reducedMotion) {
      g.position.copy(target.current);
      started.current = true;
    } else {
      tmp.copy(target.current).sub(g.position);
      const dist = tmp.length();
      // Exponential ease with a speed cap: quick across the galaxy, gentle on arrival.
      const step = Math.min(dist * (1 - Math.exp(-dt * 1.8)), 90 * dt);
      vel.copy(tmp).normalize().multiplyScalar(step);
      g.position.add(vel);
      if (step > 0.002) {
        qTarget.setFromUnitVectors(fwd, tmp.normalize());
        g.quaternion.slerp(qTarget, 1 - Math.exp(-dt * 4));
      }
      const o = 0.45 + Math.min(0.5, step / dt / 40);
      for (const sp of glow.current?.children ?? []) ((sp as THREE.Sprite).material as THREE.SpriteMaterial).opacity = o;
    }
    // Flight takes off from wherever the ship already is.
    if (!p.active) {
      p.pos.copy(g.position);
      p.quat.copy(g.quaternion);
    }
    // Exhaust: shift history, newest at the tail.
    const attr = trail.current?.geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (!attr) return;
    const arr = attr.array as Float32Array;
    arr.copyWithin(3 * nozzles, 0, arr.length - 3 * nozzles);
    for (let i = 0; i < nozzles; i++) {
      const [x, y, z] = ship.exhaust[i];
      tmp.set(x, y, z - 0.05).multiplyScalar(SCALE).applyQuaternion(g.quaternion).add(g.position);
      arr[i * 3] = tmp.x;
      arr[i * 3 + 1] = tmp.y;
      arr[i * 3 + 2] = tmp.z;
    }
    attr.needsUpdate = true;
  });

  return (
    <>
      <group ref={group} scale={SCALE}>
        <ShipModel id={ship.id} animate={!reducedMotion} glowRef={glow} />
      </group>
      <points ref={trail} raycast={() => null} frustumCulled={false} key={ship.id}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailInit, 3]} />
        </bufferGeometry>
        <pointsMaterial map={tex} color={ship.palette.glow} size={ship.trail.size} transparent opacity={ship.trail.opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </>
  );
}
