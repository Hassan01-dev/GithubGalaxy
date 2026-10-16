"use client";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PlacedPlanet } from "@/lib/galaxy/layout";
import { pushedRecently } from "@/lib/galaxy/systems";

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const v = new THREE.Vector3();
const s = new THREE.Vector3();

// Camera-facing rings expanding and fading out; animated entirely in the shader (no per-frame matrix writes).
const vertex = /* glsl */ `
  attribute float aPhase;
  uniform float uTime;
  varying float vAlpha;
  void main() {
    float t = fract(uTime * 0.45 + aPhase);
    float scale = length(instanceMatrix[0].xyz) * (1.0 + t * 1.6);
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * scale;
    // An overview signal: fades out up close, where many busy repos would turn into ring clutter.
    vAlpha = (1.0 - t) * (1.0 - t) * 0.6 * smoothstep(25.0, 70.0, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const fragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor * vAlpha, vAlpha);
  }
`;

/** "Pulse = code pushed in the last 24 hours". One instanced draw for all beacons. */
export function Beacons({ planets, visible, accent, reducedMotion }: { planets: PlacedPlanet[]; visible: boolean[]; accent: string; reducedMotion: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const live = useMemo(() => planets.flatMap((p, i) => (visible[i] && pushedRecently(p.repo.pushedAt) ? [i] : [])), [planets, visible]);
  const geometry = useMemo(() => {
    const g = new THREE.RingGeometry(0.96, 1, 48);
    // Spread phases so beacons don't pulse in lockstep.
    g.setAttribute("aPhase", new THREE.InstancedBufferAttribute(new Float32Array(live.map((i) => planets[i].seed)), 1));
    return g;
  }, [live, planets]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const a = mesh.current;
    if (!a) return;
    live.forEach((pi, k) => {
      const p = planets[pi];
      a.setMatrixAt(k, m.compose(v.set(...p.position), q, s.setScalar(p.radius * 1.5 + 0.3)));
    });
    a.instanceMatrix.needsUpdate = true;
  }, [live, planets, geometry]);

  useFrame(({ clock }) => {
    if (mat.current && !reducedMotion) mat.current.uniforms.uTime.value = clock.elapsedTime;
  });

  if (!live.length) return null;
  return (
    <instancedMesh key={live.length} ref={mesh} args={[geometry, undefined, live.length]} frustumCulled={false} raycast={() => null}>
      {/* Reduced motion: uTime stays frozen at a readable point of the pulse. */}
      <shaderMaterial ref={mat} vertexShader={vertex} fragmentShader={fragment} uniforms={{ uTime: { value: 0.6 }, uColor: { value: new THREE.Color(accent) } }} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  );
}
