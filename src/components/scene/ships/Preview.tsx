"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { getShip } from "@/lib/ships";
import { rng } from "@/lib/galaxy/layout";
import { ShipModel } from ".";

function Turntable({ id, animate }: { id: string; animate: boolean }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (animate && spin.current) spin.current.rotation.y += Math.min(dt, 0.05) * 0.45;
  });
  const glow = getShip(id).palette.glow;
  return (
    <>
      {/* Three-quarter front view even when motion is off. */}
      <group ref={spin} rotation={[0, 0.1, 0]} position={[0, 0.15, 0]}>
        <ShipModel id={id} animate={animate} />
      </group>
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[1.15, 1.22, 0.06, 48]} />
        <meshStandardMaterial color="#0b0f1e" metalness={0.2} roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.365, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.06, 1.1, 64]} />
        <meshBasicMaterial color={glow} toneMapped={false} transparent opacity={0.8} />
      </mesh>
      {/* rim light in the ship's own colour */}
      <directionalLight position={[-2, 1.5, -3]} intensity={2.2} color={glow} />
    </>
  );
}

function Stars() {
  const pos = useMemo(() => {
    const r = rng(7), a = new Float32Array(160 * 3);
    for (let i = 0; i < a.length; i += 3) a.set([(r() - 0.5) * 30, (r() - 0.2) * 16, -6 - r() * 12], i);
    return a;
  }, []);
  return (
    <points raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#cfd6ff" size={0.05} transparent opacity={0.8} depthWrite={false} />
    </points>
  );
}

/** The hangar's turntable. Lazy-loaded by Hangar, one small canvas. */
export default function ShipPreview({ id, reducedMotion }: { id: string; reducedMotion: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={reducedMotion ? "demand" : "always"}
      camera={{ position: [2.6, 1.15, 2.8], fov: 38 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.05, 0)}
      gl={{ antialias: true, powerPreference: "low-power" }}
      aria-hidden
    >
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#bcd0ff", "#1a1020", 0.6]} />
      <directionalLight position={[3, 4, 3]} intensity={2.4} />
      <Stars />
      <Turntable id={id} animate={!reducedMotion} />
    </Canvas>
  );
}
