"use client";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { languageColor, type PlacedPlanet } from "@/lib/galaxy/layout";
import { atmosphereMaterial, cloudMaterial, planetMaterial, planetVariant, ringMaterial, PLANET_STYLES, RING_IN, RING_OUT } from "./planetShader";

const ATMO = 1.12;

/**
 * High-detail stand-in for the selected planet (its instance is hidden): same surface as the overview
 * plus relief, glints, a drifting cloud deck, an atmosphere shell and, for ringed planets, detailed rings.
 * Rendered inside PlanetSystem's group, so local origin = planet centre.
 */
export function PlanetDetail({ planet, reducedMotion, lowEffects }: { planet: PlacedPlanet; reducedMotion: boolean; lowEffects: boolean }) {
  const surface = useRef<THREE.Mesh>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const style = PLANET_STYLES[planet.style] ?? PLANET_STYLES[0];

  const parts = useMemo(() => {
    const color = new THREE.Color(languageColor(planet.repo.language));
    const variant = planetVariant(planet.seed, planet.style);
    const sphere = new THREE.SphereGeometry(1, lowEffects ? 64 : 128, lowEffects ? 48 : 96);
    const surfaceMat = planetMaterial(lowEffects ? 4 : 5, true);
    const u = surfaceMat.uniforms;
    u.uColor.value.copy(color);
    u.aSeed.value = planet.seed;
    u.aStyle.value = planet.style;
    u.aVariant.value.fromArray(variant.vec);
    const tint = new THREE.Color(...style.atmo).lerp(color, 0.35);
    const cloudMat = !lowEffects && style.clouds > 0 ? cloudMaterial(planet.seed, style.clouds, tint.clone().lerp(new THREE.Color(1, 1, 1), 0.7)) : null;
    const atmoMat = style.glow > 0 ? atmosphereMaterial(tint, style.glow * 0.9, ATMO) : null;
    let ring: { geometry: THREE.BufferGeometry; material: THREE.ShaderMaterial; quaternion: THREE.Quaternion } | null = null;
    if (variant.ring) {
      const material = ringMaterial();
      material.uniforms.uColor.value.copy(color);
      material.uniforms.aSeed.value = planet.seed;
      ring = {
        geometry: new THREE.RingGeometry(RING_IN, RING_OUT, lowEffects ? 96 : 192, 1).rotateX(-Math.PI / 2),
        material,
        quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(variant.ring.tiltX, 0, variant.ring.tiltZ)),
      };
    }
    return { sphere, surfaceMat, cloudMat, atmoMat, ring };
  }, [planet, style, lowEffects]);

  useLayoutEffect(() => () => {
    parts.sphere.dispose();
    parts.surfaceMat.dispose();
    parts.cloudMat?.dispose();
    parts.atmoMat?.dispose();
    parts.ring?.geometry.dispose();
    parts.ring?.material.dispose();
  }, [parts]);

  useFrame((_, dt) => {
    if (reducedMotion) return;
    if (surface.current) surface.current.rotation.y += dt * 0.04;
    if (clouds.current) clouds.current.rotation.y += dt * 0.06;
  });

  const r = planet.radius;
  return (
    <group>
      {/* A hair above the instance radius, so it still wins if the instance isn't hidden. */}
      <mesh ref={surface} geometry={parts.sphere} material={parts.surfaceMat} scale={r * 1.003} raycast={() => null} />
      {parts.cloudMat && <mesh ref={clouds} geometry={parts.sphere} material={parts.cloudMat} scale={r * 1.025} renderOrder={1} raycast={() => null} />}
      {parts.atmoMat && <mesh geometry={parts.sphere} material={parts.atmoMat} scale={r * ATMO} raycast={() => null} />}
      {parts.ring && (
        <mesh geometry={parts.ring.geometry} material={parts.ring.material} quaternion={parts.ring.quaternion} scale={r} renderOrder={2} raycast={() => null} />
      )}
    </group>
  );
}
