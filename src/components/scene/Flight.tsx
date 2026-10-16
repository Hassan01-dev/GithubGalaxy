"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { PlacedPlanet } from "@/lib/galaxy/layout";
import { useSettings } from "@/hooks/useStores";
import { flightOf, getShip } from "@/lib/ships";

/** The ship's pose while flying. Shared with <Ship>, which simply copies it. */
export interface Pose {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  active: boolean;
  /** Planet within inspect range while flying (for the radar). */
  near: number | null;
}

// Cruise, boost and turn rate come from the chosen ship (see flightOf in lib/ships).
const BOUNDS = 420;
const CONTROL_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "KeyR", "KeyF", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight", "Space", "Enter"]);

const fwd = new THREE.Vector3();
const desired = new THREE.Vector3();
const look = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, "YXZ");

/**
 * Optional free flight. W/S throttle, A/D or ←/→ turn, ↑/↓ or R/F pitch, Shift boost, Space brake.
 * No roll, no shake, capped speed, and a chase camera that eases rather than snaps.
 */
export function FlightController({ pose, setActive, planets, visible, onNear, onSelect, onSpeed, onTravelled }: {
  pose: React.RefObject<Pose>;
  setActive: (active: boolean) => void;
  planets: PlacedPlanet[];
  visible: boolean[];
  onNear: (index: number | null) => void;
  onSelect: (index: number) => void;
  /** Called every frame; write it to the DOM, not to React state. */
  onSpeed: (speed: number) => void;
  /** About once a second: distance flown since the last call. */
  onTravelled?: (units: number) => void;
}) {
  const { camera, gl } = useThree();
  const { cruise, boost: boostMax, turn } = flightOf(getShip(useSettings().ship).stats);
  const keys = useRef(new Set<string>());
  const state = useRef({ yaw: 0, pitch: 0, speed: 0, near: null as number | null, scan: 0, flown: 0, tick: 0 });

  // Start from where the ship already is, facing the way the camera looks.
  useEffect(() => {
    camera.getWorldDirection(fwd);
    state.current.yaw = Math.atan2(fwd.x, fwd.z);
    state.current.pitch = THREE.MathUtils.clamp(Math.asin(fwd.y), -1, 1);
    state.current.speed = 0;
    setActive(true);
    return () => {
      setActive(false);
      onNear(null);
    };
  }, [camera, setActive, onNear]);

  useEffect(() => {
    const typing = (e: Event) => /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
    const down = (e: KeyboardEvent) => {
      if (typing(e) || !CONTROL_KEYS.has(e.code) || e.metaKey || e.ctrlKey) return;
      e.preventDefault(); // no page scroll on Space / arrows
      if (e.code === "Enter") {
        if (state.current.near != null) onSelect(state.current.near);
        return;
      }
      keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const clear = () => keys.current.clear();
    // Drag to look around.
    const move = (e: PointerEvent) => {
      if (!e.buttons) return;
      state.current.yaw -= e.movementX * 0.004;
      state.current.pitch = THREE.MathUtils.clamp(state.current.pitch - e.movementY * 0.003, -1.1, 1.1);
    };
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    addEventListener("blur", clear);
    gl.domElement.addEventListener("pointermove", move);
    return () => {
      removeEventListener("keydown", down);
      removeEventListener("keyup", up);
      removeEventListener("blur", clear);
      gl.domElement.removeEventListener("pointermove", move);
    };
  }, [gl, onSelect]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const k = keys.current, s = state.current, p = pose.current;
    const has = (...codes: string[]) => codes.some((c) => k.has(c));

    s.yaw += ((has("KeyA", "ArrowLeft") ? 1 : 0) - (has("KeyD", "ArrowRight") ? 1 : 0)) * turn * dt;
    s.pitch = THREE.MathUtils.clamp(s.pitch + ((has("ArrowUp", "KeyR") ? 1 : 0) - (has("ArrowDown", "KeyF") ? 1 : 0)) * 1.0 * dt, -1.1, 1.1);

    const boost = has("ShiftLeft", "ShiftRight");
    const max = boost ? boostMax : cruise;
    if (has("Space")) s.speed *= Math.exp(-dt * 6);
    else if (has("KeyW")) s.speed = Math.min(max, s.speed + 30 * dt);
    else if (has("KeyS")) s.speed = Math.max(-10, s.speed - 30 * dt);
    else s.speed *= Math.exp(-dt * 0.5); // gentle drift to a stop, never a jolt
    if (s.speed > max) s.speed = THREE.MathUtils.lerp(s.speed, max, 1 - Math.exp(-dt * 2));

    p.quat.setFromEuler(euler.set(-s.pitch, s.yaw, 0));
    fwd.set(0, 0, 1).applyQuaternion(p.quat);
    p.pos.addScaledVector(fwd, s.speed * dt);
    if (p.pos.length() > BOUNDS) p.pos.setLength(BOUNDS);

    // Chase camera: behind and slightly above, eased.
    desired.copy(p.pos).addScaledVector(fwd, -9);
    desired.y += 3;
    camera.position.lerp(desired, 1 - Math.exp(-dt * 5));
    camera.lookAt(look.copy(p.pos).addScaledVector(fwd, 12));

    onSpeed(Math.abs(s.speed));

    s.flown += Math.abs(s.speed) * dt;
    s.tick += dt;
    if (s.tick >= 1) {
      if (s.flown > 0.01) onTravelled?.(s.flown);
      s.flown = s.tick = 0;
    }

    // Proximity scan a few times a second, not every frame.
    s.scan -= dt;
    if (s.scan <= 0) {
      s.scan = 0.25;
      let best: number | null = null, bestD = Infinity;
      for (let i = 0; i < planets.length; i++) {
        if (!visible[i]) continue;
        const pl = planets[i].position;
        const d = Math.hypot(pl[0] - p.pos.x, pl[1] - p.pos.y, pl[2] - p.pos.z) - planets[i].radius;
        if (d < 10 && d < bestD) {
          best = i;
          bestD = d;
        }
      }
      if (best !== s.near) {
        s.near = best;
        onNear(best);
      }
    }
  });

  return null;
}
