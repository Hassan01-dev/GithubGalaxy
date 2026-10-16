"use client";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { getShip, type ShipDef, type ShipId } from "@/lib/ships";
import { useGlow } from "../Backdrop";
import { Canopy, FLAT, Lit, NavLights, Nozzle, Paint, outline, profile } from "./parts";

/*
 * Procedural ship models. Shared conventions: +Z forward, +Y up, ~1.6–2.2 units long.
 * Module-level profiles/shapes are CPU-only data; geometries and materials are declared in JSX so R3F disposes them.
 */

type ModelProps = { ship: ShipDef; animate: boolean };

const EXTRUDE_THIN = { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 };

// ---------- Scout: the original little dart, refined ----------
const SCOUT_HULL = profile([[0, -0.85], [0.17, -0.85], [0.27, -0.55], [0.3, -0.1], [0.24, 0.35], [0.12, 0.75], [0, 0.97]]);
const SCOUT_WING = outline([[0, 0.3], [0.85, -0.48], [0.8, -0.62], [-0.8, -0.62], [-0.85, -0.48]]);
const SCOUT_FIN = outline([[-0.8, 0], [-0.45, 0], [-0.7, 0.32], [-0.82, 0.32]]);

function Scout({ ship, animate }: ModelProps) {
  const { hull, trim, glow } = ship.palette;
  return (
    <group>
      <mesh rotation={FLAT}>
        <latheGeometry args={[SCOUT_HULL, 6]} />
        <Paint color={hull} />
      </mesh>
      <mesh rotation={FLAT}>
        <extrudeGeometry args={[SCOUT_WING, EXTRUDE_THIN]} />
        <Paint color={trim} />
      </mesh>
      {/* glowing leading-edge stripes */}
      <mesh position={[0.43, 0.02, -0.09]} rotation={[0, -0.83, 0]}>
        <boxGeometry args={[0.02, 0.012, 0.85]} />
        <Lit color={glow} intensity={1.2} />
      </mesh>
      <mesh position={[-0.43, 0.02, -0.09]} rotation={[0, 0.83, 0]}>
        <boxGeometry args={[0.02, 0.012, 0.85]} />
        <Lit color={glow} intensity={1.2} />
      </mesh>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[0.015, 0.2, 0]}>
        <extrudeGeometry args={[SCOUT_FIN, { depth: 0.03, bevelEnabled: false }]} />
        <Paint color={trim} />
      </mesh>
      <Canopy position={[0, 0.17, 0.2]} scale={[0.13, 0.12, 0.32]} tint={glow} />
      <Nozzle at={[0, 0, -0.95]} r={0.16} trim={trim} glow={glow} />
      <NavLights x={0.84} y={-0.01} z={-0.56} animate={animate} />
    </group>
  );
}

// ---------- Interceptor: swept-wing needle ----------
const INT_HULL = profile([[0, -1.0], [0.12, -1.0], [0.18, -0.7], [0.2, -0.2], [0.15, 0.4], [0.07, 0.9], [0, 1.18]]);
const INT_WING = outline([[0.12, 0.05], [1.0, -0.82], [1.0, -0.94], [0.12, -0.72]]);
const INT_TIP = outline([[0.78, -0.6], [1.0, -0.82], [1.0, -0.94], [0.78, -0.86]]);
const INT_CANARD = outline([[0.1, 0.62], [0.36, 0.42], [0.36, 0.38], [0.1, 0.45]]);

function Interceptor({ ship, animate }: ModelProps) {
  const { hull, trim, glow } = ship.palette;
  return (
    <group>
      <mesh rotation={FLAT}>
        <latheGeometry args={[INT_HULL, 8]} />
        <Paint color={hull} metal={0.4} rough={0.3} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} scale={[s, 1, 1]}>
          <mesh rotation={FLAT}>
            <extrudeGeometry args={[INT_WING, EXTRUDE_THIN]} />
            <Paint color={hull} metal={0.4} rough={0.3} />
          </mesh>
          <mesh rotation={FLAT} position={[0, 0.012, 0]}>
            <extrudeGeometry args={[INT_TIP, { depth: 0.05, bevelEnabled: false }]} />
            <Paint color={trim} />
          </mesh>
          <mesh rotation={FLAT} position={[0, 0.03, 0]}>
            <extrudeGeometry args={[INT_CANARD, { depth: 0.03, bevelEnabled: false }]} />
            <Paint color={trim} />
          </mesh>
          {/* canted twin tails */}
          <mesh position={[0.17, 0.2, -0.78]} rotation={[-0.35, 0, -0.32]}>
            <boxGeometry args={[0.025, 0.36, 0.3]} />
            <Paint color={trim} />
          </mesh>
          {/* intake glow */}
          <mesh position={[0.17, -0.02, 0.05]}>
            <boxGeometry args={[0.05, 0.06, 0.2]} />
            <Lit color={glow} intensity={0.9} />
          </mesh>
        </group>
      ))}
      <Canopy position={[0, 0.13, 0.4]} scale={[0.1, 0.09, 0.42]} tint={glow} />
      <Nozzle at={[0, 0, -1.04]} r={0.12} trim={trim} glow={glow} length={0.12} />
      <NavLights x={1.0} z={-0.9} animate={animate} />
    </group>
  );
}

// ---------- Manta: flat stingray wing with a glowing belly ----------
const MANTA_BODY = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0.85);
  s.quadraticCurveTo(0.55, 0.6, 1.1, -0.2);
  s.quadraticCurveTo(0.7, -0.26, 0.38, -0.6);
  s.lineTo(0, -0.46);
  s.lineTo(-0.38, -0.6);
  s.quadraticCurveTo(-0.7, -0.26, -1.1, -0.2);
  s.quadraticCurveTo(-0.55, 0.6, 0, 0.85);
  return s;
})();

function Manta({ ship, animate }: ModelProps) {
  const { hull, trim, glow } = ship.palette;
  const belly = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (animate && belly.current) belly.current.opacity = 0.45 + 0.2 * Math.sin(clock.elapsedTime * 1.6);
  });
  return (
    <group>
      <mesh rotation={FLAT} position={[0, 0.06, 0]}>
        <extrudeGeometry args={[MANTA_BODY, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 16 }]} />
        <Paint color={hull} metal={0.35} rough={0.45} flat={false} />
      </mesh>
      {/* dorsal hump and trim ridge */}
      <mesh position={[0, 0.06, 0.05]} scale={[0.32, 0.13, 0.7]}>
        <sphereGeometry args={[1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Paint color={trim} metal={0.5} rough={0.3} flat={false} />
      </mesh>
      <mesh rotation={FLAT} position={[0, -0.09, 0]} scale={[0.86, 0.86, 1]}>
        <shapeGeometry args={[MANTA_BODY, 16]} />
        <meshBasicMaterial ref={belly} color={glow} transparent opacity={0.55} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* whip tail */}
      <mesh rotation={FLAT} position={[0, 0.03, -0.8]}>
        <cylinderGeometry args={[0.04, 0.012, 0.75, 6]} />
        <Paint color={trim} />
      </mesh>
      <mesh position={[0, 0.03, -1.17]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <Lit color={glow} intensity={2} />
      </mesh>
      <Canopy position={[0, 0.15, 0.35]} scale={[0.14, 0.08, 0.24]} tint={glow} />
      <Nozzle at={[0.28, 0.02, -0.64]} r={0.08} trim={trim} glow={glow} length={0.1} />
      <Nozzle at={[-0.28, 0.02, -0.64]} r={0.08} trim={trim} glow={glow} length={0.1} />
      <NavLights x={1.13} y={0.04} z={-0.2} animate={animate} />
    </group>
  );
}

// ---------- Hauler: chunky freighter with cargo pods ----------
function Hauler({ ship, animate }: ModelProps) {
  const { hull, trim, glow } = ship.palette;
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (animate && beacon.current) beacon.current.emissiveIntensity = 0.6 + 2.4 * Math.max(0, Math.sin(clock.elapsedTime * 2.2)) ** 10;
  });
  return (
    <group>
      <RoundedBox args={[0.5, 0.4, 1.45]} radius={0.07} smoothness={2} position={[0, 0, -0.12]}>
        <Paint color={trim} metal={0.5} rough={0.45} flat={false} />
      </RoundedBox>
      <RoundedBox args={[0.44, 0.3, 0.42]} radius={0.08} smoothness={3} position={[0, 0.05, 0.74]}>
        <Paint color={hull} metal={0.35} rough={0.4} flat={false} />
      </RoundedBox>
      {/* wraparound bridge window */}
      <mesh position={[0, 0.1, 0.93]}>
        <boxGeometry args={[0.34, 0.08, 0.06]} />
        <meshPhysicalMaterial color="#0b1526" roughness={0.05} clearcoat={1} emissive={glow} emissiveIntensity={0.5} />
      </mesh>
      {/* cargo pods: two per side, alternating paint */}
      {[1, -1].flatMap((s) =>
        [0.13, -0.15].map((y, j) => (
          <mesh key={`${s}${y}`} position={[s * 0.42, y, -0.18]} rotation={FLAT}>
            <capsuleGeometry args={[0.12, 0.62, 4, 12]} />
            <Paint color={j ? trim : hull} metal={0.35} rough={0.5} flat={false} />
          </mesh>
        )),
      )}
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.3, 0, -0.18]}>
            <boxGeometry args={[0.14, 0.05, 0.5]} />
            <Paint color={hull} />
          </mesh>
          {/* engine housing */}
          <mesh position={[s * 0.3, 0.02, -0.82]} rotation={FLAT}>
            <cylinderGeometry args={[0.15, 0.17, 0.3, 14]} />
            <Paint color={hull} metal={0.5} rough={0.35} />
          </mesh>
          <mesh position={[s * 0.3, 0.02, -0.72]}>
            <torusGeometry args={[0.17, 0.02, 6, 20]} />
            <Lit color={glow} intensity={0.8} />
          </mesh>
        </group>
      ))}
      <Nozzle at={[0.3, 0.02, -0.98]} r={0.15} trim={trim} glow={glow} length={0.08} />
      <Nozzle at={[-0.3, 0.02, -0.98]} r={0.15} trim={trim} glow={glow} length={0.08} />
      {/* mast with an amber beacon */}
      <mesh position={[0, 0.3, -0.35]}>
        <cylinderGeometry args={[0.012, 0.012, 0.2, 5]} />
        <Paint color={hull} />
      </mesh>
      <mesh position={[0, 0.41, -0.35]}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshStandardMaterial ref={beacon} color="#000000" emissive="#ffb547" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      <NavLights x={0.55} z={0.1} animate={animate} />
    </group>
  );
}

// ---------- Ring Runner: saucer inside a spinning ring drive ----------
const SAUCER = profile([[0, -0.11], [0.42, -0.1], [0.6, -0.03], [0.6, 0.02], [0.42, 0.09], [0, 0.11]]);
const STUDS = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2);

function RingRunner({ ship, animate }: ModelProps) {
  const { hull, trim, glow } = ship.palette;
  const ring = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (animate && ring.current) ring.current.rotation.y += Math.min(dt, 0.05) * 1.4;
  });
  return (
    <group>
      <mesh>
        <latheGeometry args={[SAUCER, 36]} />
        <Paint color={hull} metal={0.5} rough={0.3} flat={false} />
      </mesh>
      {/* panel ring on the hull */}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.36, 36]} />
        <Lit color={glow} intensity={0.8} />
      </mesh>
      <Canopy position={[0, 0.09, 0.04]} scale={[0.24, 0.16, 0.24]} tint={glow} />
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.68, 0.025, 6, 48]} />
        <Paint color={trim} metal={0.6} rough={0.3} flat={false} />
      </mesh>
      <group ref={ring}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.84, 0.055, 10, 64]} />
          <Paint color={trim} metal={0.55} rough={0.25} flat={false} />
        </mesh>
        {STUDS.map((a) => (
          <mesh key={a} position={[Math.cos(a) * 0.84, 0, Math.sin(a) * 0.84]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.07, 0.13, 0.05]} />
            <Lit color={glow} intensity={1.8} />
          </mesh>
        ))}
      </group>
      {/* aft drive pod gives the saucer a readable front and back */}
      <mesh position={[0, 0, -0.62]} rotation={FLAT}>
        <cylinderGeometry args={[0.1, 0.12, 0.26, 12]} />
        <Paint color={hull} />
      </mesh>
      <Nozzle at={[0, 0, -0.76]} r={0.11} trim={trim} glow={glow} length={0.04} />
      <NavLights x={0.6} z={0} animate={animate} />
    </group>
  );
}

// ---------- Solar Lantern: slender core under a gossamer sail ----------
const LANTERN_CORE = profile([[0, -0.95], [0.08, -0.95], [0.12, -0.6], [0.1, 0.4], [0.06, 0.78], [0, 0.88]]);
const SAIL = outline([[0, 0.95], [0.95, 0], [0, -0.95], [-0.95, 0]]);

function Lantern({ ship, animate }: ModelProps) {
  const { hull, trim, glow } = ship.palette;
  const sail = useRef<THREE.MeshPhysicalMaterial>(null);
  useFrame(({ clock }) => {
    const m = sail.current;
    if (!animate || !m) return;
    const t = clock.elapsedTime;
    // Sweep the thin-film thickness so the iridescence ripples through colours.
    m.iridescenceThicknessRange[1] = 520 + 220 * Math.sin(t * 0.9);
    m.emissiveIntensity = 0.22 + 0.1 * Math.sin(t * 2.3);
  });
  return (
    <group>
      <mesh rotation={FLAT}>
        <latheGeometry args={[LANTERN_CORE, 10]} />
        <Paint color={hull} metal={0.5} rough={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.92]}>
        <sphereGeometry args={[0.09, 14, 10]} />
        <Lit color={glow} intensity={2.4} />
      </mesh>
      {/* booms */}
      <mesh position={[0, 0, -0.15]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 1.9, 5]} />
        <Paint color={trim} />
      </mesh>
      <mesh position={[0, 0, -0.15]}>
        <cylinderGeometry args={[0.012, 0.012, 1.9, 5]} />
        <Paint color={trim} />
      </mesh>
      <mesh position={[0, 0, -0.17]}>
        <shapeGeometry args={[SAIL]} />
        <meshPhysicalMaterial
          ref={sail}
          color={hull}
          emissive={glow}
          emissiveIntensity={0.25}
          metalness={0.1}
          roughness={0.2}
          iridescence={1}
          iridescenceIOR={1.4}
          iridescenceThicknessRange={[180, 520]}
          transparent
          opacity={0.42}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* gold collar where the sail meets the core */}
      <mesh position={[0, 0, -0.15]}>
        <torusGeometry args={[0.13, 0.025, 6, 18]} />
        <Paint color={trim} metal={0.7} rough={0.25} flat={false} />
      </mesh>
      <Nozzle at={[0, 0, -0.98]} r={0.08} trim={trim} glow={glow} length={0.08} />
      <NavLights x={0.95} z={-0.15} animate={animate} />
    </group>
  );
}

const MODELS: Record<ShipId, (p: ModelProps) => React.ReactNode> = {
  scout: Scout,
  interceptor: Interceptor,
  manta: Manta,
  hauler: Hauler,
  ringrunner: RingRunner,
  lantern: Lantern,
};

/**
 * One source of truth for the galaxy ship and the hangar preview.
 * `glowRef` groups the engine glow sprites so the caller can modulate their opacity.
 */
export function ShipModel({ id, animate, glowRef }: { id: string; animate: boolean; glowRef?: React.Ref<THREE.Group> }) {
  const ship = getShip(id);
  const Model = MODELS[ship.id];
  const tex = useGlow();
  return (
    <group>
      <Model ship={ship} animate={animate} />
      <group ref={glowRef}>
        {ship.exhaust.map((p) => (
          <sprite key={p.join()} position={p} scale={ship.exhaust.length > 1 ? 0.75 : 1.1} raycast={() => null}>
            <spriteMaterial map={tex} color={ship.palette.glow} transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        ))}
      </group>
    </group>
  );
}
