"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { languageColor, type PlacedPlanet } from "@/lib/galaxy/layout";
import { planetMaterial, planetVariant, ringMaterial, RING_IN, RING_OUT } from "./planetShader";

interface Props {
  planets: PlacedPlanet[];
  visible: boolean[];
  lowEffects: boolean;
  /** The selected planet, drawn by PlanetDetail instead; its low-detail instance (and rings) collapse. */
  hiddenIndex?: number | null;
  onHover: (index: number | null) => void;
  onSelect: (index: number, travel: boolean) => void;
}

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const eu = new THREE.Euler();
const v = new THREE.Vector3();
const s = new THREE.Vector3();
// Hovered instance; brightens its rim. Module-level so hovering never re-renders (one galaxy is mounted at a time).
const hoverUniform = { value: -1 };

export function Planets({ planets, visible, lowEffects, hiddenIndex, onHover, onSelect }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const hit = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((st) => st.invalidate);
  const count = planets.length;

  const variants = useMemo(() => planets.map((p) => planetVariant(p.seed, p.style)), [planets]);
  const ringed = useMemo(() => variants.flatMap((x, i) => (x.ring ? [i] : [])), [variants]);

  const geometry = useMemo(() => {
    const g = lowEffects ? new THREE.SphereGeometry(1, 20, 14) : new THREE.SphereGeometry(1, 40, 28);
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(planets.map((p) => p.seed)), 1));
    g.setAttribute("aStyle", new THREE.InstancedBufferAttribute(new Float32Array(planets.map((p) => p.style)), 1));
    g.setAttribute("aVariant", new THREE.InstancedBufferAttribute(new Float32Array(variants.flatMap((x) => x.vec)), 4));
    return g;
  }, [planets, variants, lowEffects]);
  const ringGeometry = useMemo(() => {
    const g = new THREE.RingGeometry(RING_IN, RING_OUT, 48, 1).rotateX(-Math.PI / 2);
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(ringed.map((i) => planets[i].seed)), 1));
    return g;
  }, [planets, ringed]);
  const hitGeometry = useMemo(() => new THREE.SphereGeometry(1, 8, 6), []);
  // Fewer noise octaves on low effects: the fragment shader is the planets' main cost.
  const material = useMemo(() => planetMaterial(lowEffects ? 3 : 4, false, hoverUniform), [lowEffects]);
  const ringMat = useMemo(() => ringMaterial(), []);
  // Invisible, larger spheres catch the pointer so small planets are easy to click and tap.
  const hitMaterial = useMemo(() => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), []);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => () => ringGeometry.dispose(), [ringGeometry]);
  useLayoutEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => () => (hitGeometry.dispose(), ringMat.dispose(), hitMaterial.dispose()), [hitGeometry, ringMat, hitMaterial]);

  useLayoutEffect(() => {
    const a = mesh.current, b = hit.current, rm = rings.current;
    if (!a || !b) return;
    const color = new THREE.Color();
    planets.forEach((p, i) => {
      const r = visible[i] ? p.radius : 0;
      m.compose(v.set(...p.position), q.identity(), s.setScalar(i === hiddenIndex ? 0 : r));
      a.setMatrixAt(i, m);
      m.compose(v, q, s.setScalar(visible[i] ? Math.max(r * 1.6, r + 1.4) : 0));
      b.setMatrixAt(i, m);
      a.setColorAt(i, color.set(languageColor(p.repo.language)));
    });
    a.instanceMatrix.needsUpdate = b.instanceMatrix.needsUpdate = true;
    if (a.instanceColor) a.instanceColor.needsUpdate = true;
    // Raycasts test the bounding sphere first; it must cover moved instances.
    a.computeBoundingSphere();
    b.computeBoundingSphere();
    if (rm) {
      ringed.forEach((i, k) => {
        const p = planets[i], t = variants[i].ring!;
        q.setFromEuler(eu.set(t.tiltX, 0, t.tiltZ));
        m.compose(v.set(...p.position), q, s.setScalar(visible[i] && i !== hiddenIndex ? p.radius : 0));
        rm.setMatrixAt(k, m);
        rm.setColorAt(k, color.set(languageColor(p.repo.language)));
      });
      rm.instanceMatrix.needsUpdate = true;
      if (rm.instanceColor) rm.instanceColor.needsUpdate = true;
    }
  }, [planets, visible, hiddenIndex, variants, ringed, geometry, ringGeometry]);

  const hover = (i: number | null) => {
    if (hoverUniform.value !== (i ?? -1)) {
      hoverUniform.value = i ?? -1;
      invalidate();
    }
    onHover(i);
  };

  // A drag that ends over a planet is a camera move, not a selection.
  const isClick = (e: ThreeEvent<MouseEvent>) => e.delta < 6;

  return (
    <>
      <instancedMesh key={`v${count}-${lowEffects}`} ref={mesh} args={[geometry, material, count]} frustumCulled={false} raycast={() => null} />
      {ringed.length > 0 && (
        <instancedMesh key={`r${ringed.length}-${count}`} ref={rings} args={[ringGeometry, ringMat, ringed.length]} frustumCulled={false} raycast={() => null} />
      )}
      <instancedMesh
        key={`h${count}`}
        ref={hit}
        args={[hitGeometry, hitMaterial, count]}
        renderOrder={-1}
        onPointerMove={(e) => (e.stopPropagation(), hover(e.instanceId ?? null))}
        onPointerOut={() => hover(null)}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId != null && isClick(e)) onSelect(e.instanceId, false);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (e.instanceId != null) onSelect(e.instanceId, true);
        }}
      />
    </>
  );
}
