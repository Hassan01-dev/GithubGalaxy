"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ARMS, ARM_TWIST, GALAXY_RADIUS, hash, rng } from "@/lib/galaxy/layout";
import type { GalaxyTheme } from "@/types";

/** Soft round points with optional twinkle. One draw call for thousands of particles. */
function pointsMaterial(twinkle: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixel: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec3 aColor;
      uniform float uTime;
      uniform float uPixel;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 1.0 - ${twinkle.toFixed(2)} * (0.5 + 0.5 * sin(uTime * 0.8 + position.x * 12.9 + position.z * 7.3));
        vColor = aColor;
        vAlpha = tw;
        // Capped so particles near the camera stay specks, not blobs.
        gl_PointSize = min(aSize * uPixel * (300.0 / -mv.z), 6.0 * uPixel);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor * a * vAlpha, a * vAlpha);
      }
    `,
  });
}

export type CloudData = { pos: Float32Array; col: Float32Array; size: Float32Array };

/** Buffers are declared in JSX so R3F disposes them; uniforms are driven through the ref. */
export function Cloud({ data, twinkle }: { data: CloudData; twinkle: number }) {
  const ref = useRef<THREE.Points>(null);
  const material = useMemo(() => pointsMaterial(twinkle), [twinkle]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock, gl }) => {
    const m = ref.current?.material as THREE.ShaderMaterial | undefined;
    if (!m) return;
    m.uniforms.uTime.value = clock.elapsedTime;
    m.uniforms.uPixel.value = gl.getPixelRatio();
  });
  return (
    <points ref={ref} material={material} raycast={() => null} key={data.pos.length}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.pos, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[data.col, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[data.size, 1]} />
      </bufferGeometry>
    </points>
  );
}

/** Distant stars on a shell around everything. Decorative; never intercepts the pointer. */
export function Starfield({ count }: { count: number }) {
  const data = useMemo(() => {
    const r = rng(42);
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, d = 500 + r() * 400, s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(th) * s * d, u * d, Math.sin(th) * s * d], i * 3);
      c.setHSL(0.55 + r() * 0.15, 0.3, 0.6 + r() * 0.35);
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = 1.2 + r() ** 3 * 5;
    }
    return { pos, col, size };
  }, [count]);
  return <Cloud data={data} twinkle={0.45} />;
}

/** The galaxy's silhouette: dust following the same arms the planets sit on. */
export interface Cluster {
  centre: [number, number, number];
  radius: number;
}

/** With `clusters`, dust forms a soft elliptical halo with a glowing knot around each star system. */
export function Dust({ count, theme, seed, clusters }: { count: number; theme: GalaxyTheme; seed: string; clusters?: Cluster[] }) {
  const data = useMemo(() => {
    const r = rng(hash(seed));
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count);
    const core = new THREE.Color(theme.core), edge = new THREE.Color(theme.edge), accent = new THREE.Color(theme.accent), c = new THREE.Color();
    const R = GALAXY_RADIUS * 1.12;
    const gauss = () => (r() + r() + r() - 1.5) / 1.5;
    for (let i = 0; i < count; i++) {
      if (clusters?.length) {
        const k = r() < 0.35 ? -1 : Math.floor(r() * clusters.length);
        let x: number, y: number, z: number, t: number;
        if (k < 0) {
          x = gauss() * 85; y = gauss() * 28; z = gauss() * 70;
          t = Math.min(1, Math.hypot(x, y, z) / R);
        } else {
          const cl = clusters[k], d = cl.radius * 1.3;
          x = cl.centre[0] + gauss() * d; y = cl.centre[1] + gauss() * d * 0.5; z = cl.centre[2] + gauss() * d;
          t = Math.min(1, Math.hypot(x - cl.centre[0], z - cl.centre[2]) / (d * 2.5));
        }
        pos.set([x, y, z], i * 3);
        c.copy(core).lerp(accent, Math.min(1, t * 1.6)).lerp(edge, Math.max(0, t * 1.2 - 0.3));
        const dim = (k < 0 ? 0.35 : 0.55) * (0.5 + 0.5 * r());
        col.set([c.r * dim, c.g * dim, c.b * dim], i * 3);
        size[i] = 0.8 + r() * 2;
        continue;
      }
      // Exponential falloff: bright dense core, sparse outskirts.
      const rad = Math.min(R, -Math.log(1 - r() * 0.98) * R * 0.3);
      const arm = Math.floor(r() * ARMS);
      const spread = (0.25 + (rad / R) * 0.5) * (r() - 0.5) * 2 * (r() < 0.25 ? 2.4 : 1);
      const th = (arm / ARMS) * Math.PI * 2 + rad * ARM_TWIST + spread;
      const y = (r() - 0.5) * 2 * (1.5 + 6 * (1 - rad / R)) * r();
      pos.set([Math.cos(th) * rad, y, Math.sin(th) * rad], i * 3);
      const t = rad / R;
      c.copy(core).lerp(accent, Math.min(1, t * 1.8)).lerp(edge, Math.max(0, t * 1.4 - 0.4));
      const dim = 0.45 + 0.75 * (1 - t) * (0.4 + 0.6 * r());
      col.set([c.r * dim, c.g * dim, c.b * dim], i * 3);
      size[i] = 0.8 + r() * (t < 0.15 ? 4 : 2.2);
    }
    return { pos, col, size };
  }, [count, theme, seed, clusters]);
  return <Cloud data={data} twinkle={0.15} />;
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Shared soft glow sprite texture. */
export function useGlow() {
  const tex = useMemo(() => glowTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** Bright core plus a few faint nebula clouds placed from the galaxy's seed. */
export function CoreAndNebulae({ theme, seed, nebulae }: { theme: GalaxyTheme; seed: string; nebulae: boolean }) {
  const tex = useGlow();
  const clouds = useMemo(() => {
    const r = rng(hash(seed + ":nebula"));
    return Array.from({ length: 6 }, (_, i) => {
      const a = r() * Math.PI * 2, d = 50 + r() * 70;
      return { key: i, pos: [Math.cos(a) * d, (r() - 0.5) * 30, Math.sin(a) * d] as [number, number, number], scale: 90 + r() * 110, color: i % 2 ? theme.edge : theme.accent };
    });
  }, [seed, theme]);
  const group = useRef<THREE.Group>(null);
  // Camera-facing glows fill the screen when you fly into them; fade them by distance instead.
  useFrame(({ camera }) => {
    for (const child of group.current?.children ?? []) {
      const sp = child as THREE.Sprite;
      const base = sp.userData.opacity as number;
      const d = camera.position.distanceTo(sp.position) / sp.scale.x;
      (sp.material as THREE.SpriteMaterial).opacity = base * THREE.MathUtils.smoothstep(d, 0.35, 1.1);
    }
  });
  return (
    <group ref={group}>
      <sprite scale={70} raycast={() => null} userData={{ opacity: 0.9 }}>
        <spriteMaterial map={tex} color={theme.core} transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite scale={18} raycast={() => null} userData={{ opacity: 1 }}>
        <spriteMaterial map={tex} color="#ffffff" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {nebulae &&
        clouds.map((c) => (
          <sprite key={c.key} position={c.pos} scale={c.scale} raycast={() => null} userData={{ opacity: 0.07 }}>
            <spriteMaterial map={tex} color={c.color} transparent opacity={0.07} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        ))}
    </group>
  );
}
