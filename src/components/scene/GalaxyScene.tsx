"use client";
import { CameraControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { WebGLRenderer } from "three";
import * as THREE from "three";
import { related, strongestLinks } from "@/lib/discovery/related";
import type { PlacedPlanet } from "@/lib/galaxy/layout";
import type { GalaxyTheme, PlanetScan } from "@/types";
import { CoreAndNebulae, Dust, Starfield, type Cluster } from "./Backdrop";
import { Beacons } from "./Beacons";
import { LabelLayer, LabelProjector, useLabelEls, type Label3D, type LabelEls } from "./Labels";
import { FlightController, type Pose } from "./Flight";
import { PlanetSystem } from "./PlanetSystem";
import { Planets } from "./Planets";
import { Radar } from "./Radar";
import { Route } from "./Route";
import { Ship } from "./Ship";

export interface SceneApi {
  reset(): void;
  zoom(direction: 1 | -1): void;
}

export interface SceneProps {
  planets: PlacedPlanet[];
  visible: boolean[];
  selected: number | null;
  /** A new object requests a camera trip to that planet. */
  travel: { index: number } | null;
  theme: GalaxyTheme;
  seed: string;
  regionLabels: { title: string; position: [number, number, number] }[];
  /** Star-system centres for clustered galaxies; shapes the dust. */
  clusters?: Cluster[];
  reducedMotion: boolean;
  lowEffects: boolean;
  connections: boolean;
  onSelect: (index: number | null, travel: boolean) => void;
  onContextLost: () => void;
  apiRef: React.Ref<SceneApi>;
  /** Optional free flight (desktop). */
  flight: boolean;
  onNear: (index: number | null) => void;
  onSpeed: (speed: number) => void;
  /** Deeper data for the selected planet: satellites (releases), city lights (contributors), activity pulse. */
  scan?: PlanetScan | null;
  /** Shows a scan sweep over the selected planet while its scan loads. */
  scanning?: boolean;
  /** A journey: `indices` into `planets` in stop order; `active` is a position in `indices`. */
  route?: { indices: number[]; active: number | null } | null;
  /** While flying, about once a second: distance flown since the last call. */
  onTravelled?: (units: number) => void;
}

const HOME = { pos: new THREE.Vector3(0, 95, 165), target: new THREE.Vector3(0, 0, 0) };
const tmp = new THREE.Vector3();

function Connections({ planets, visible, selected, overview }: { planets: PlacedPlanet[]; visible: boolean[]; selected: number | null; overview: boolean }) {
  const { geometry, opacity } = useMemo(() => {
    const idx = new Map(planets.map((p, i) => [p.repo.id, i]));
    const pool = planets.filter((_, i) => visible[i]).map((p) => p.repo);
    let pairs: [number, number][] = [];
    if (selected != null) pairs = related(planets[selected].repo, pool, 6).map((r) => [selected, idx.get(r.repo.id)!]);
    else if (overview) pairs = strongestLinks(pool, 2, 36).map(([a, b]) => [idx.get(a)!, idx.get(b)!]);
    const pos = new Float32Array(pairs.length * 6);
    pairs.forEach(([a, b], k) => pos.set([...planets[a].position, ...planets[b].position], k * 6));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { geometry: g, opacity: selected != null ? 0.55 : 0.14 };
  }, [planets, visible, selected, overview]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry} raycast={() => null}>
      <lineBasicMaterial color="#cfd6ff" transparent opacity={opacity} depthWrite={false} />
    </lineSegments>
  );
}

type WorldProps = SceneProps & { setHovered: (i: number | null) => void; labels: Label3D[]; labelEls: LabelEls; pose: React.RefObject<Pose>; setActive: (active: boolean) => void };

const FOV = 50;
const KICK = 0.9;

function World(props: WorldProps) {
  const { planets, visible, selected, travel, theme, seed, reducedMotion, lowEffects, connections, onSelect, apiRef, setHovered } = props;
  const controls = useRef<CameraControls>(null);
  const shipTarget = useRef(new THREE.Vector3(0, 4, 120));
  const focused = useRef(false);
  const smooth = !reducedMotion;
  const { flight, pose, setActive } = props;
  const kick = useRef(0);
  const wasFlying = useRef(false);

  // Back from flight: orbit around the ship's current spot instead of snapping to the origin.
  useEffect(() => {
    if (!flight && wasFlying.current) {
      const c = controls.current;
      if (c) c.setLookAt(...c.camera.position.toArray(), ...pose.current.pos.toArray(), false);
    }
    wasFlying.current = flight;
  }, [flight, pose]);

  useImperativeHandle(apiRef, () => ({
    reset() {
      focused.current = false;
      controls.current?.setLookAt(...HOME.pos.toArray(), ...HOME.target.toArray(), smooth);
    },
    zoom(direction) {
      const c = controls.current;
      if (c) c.dolly(direction * c.distance * 0.3, smooth);
    },
  }), [smooth]);

  // Travel: keep the current viewing angle, approach to a distance that frames the planet.
  useEffect(() => {
    const c = controls.current;
    if (!c || !travel) return;
    const p = planets[travel.index];
    if (!p) return;
    focused.current = true;
    // Approach from slightly above so the planet isn't framed against a wall of neighbours.
    const dir = c.camera.position.clone().sub(tmp.set(...p.position)).normalize();
    dir.y = Math.max(dir.y, 0) + 0.45;
    dir.normalize();
    const dist = p.radius * 4.5 + 4;
    // Long hops get a brief FOV kick: a hint of a jump, not a ride.
    if (smooth && c.camera.position.distanceTo(tmp) > 60) kick.current = KICK;
    c.setLookAt(p.position[0] + dir.x * dist, p.position[1] + dir.y * dist + 2, p.position[2] + dir.z * dist, ...p.position, smooth);
    // Only an explicit travel request moves the camera, never a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travel]);

  // Leaving a planet returns to the overview the visitor came from.
  useEffect(() => {
    if (selected == null && focused.current) {
      focused.current = false;
      controls.current?.setLookAt(...HOME.pos.toArray(), ...HOME.target.toArray(), smooth);
    }
  }, [selected, smooth]);

  useFrame(({ camera }, dt) => {
    if (kick.current > 0 && camera instanceof THREE.PerspectiveCamera) {
      kick.current = Math.max(0, kick.current - dt);
      camera.fov = FOV + Math.sin(Math.PI * (1 - kick.current / KICK)) * 7;
      camera.updateProjectionMatrix();
    }
    const c = controls.current;
    if (!c) return;
    if (selected != null && planets[selected]) {
      const p = planets[selected];
      // Park off to the side (camera-right) so the ship frames the planet instead of covering it.
      tmp.setFromMatrixColumn(c.camera.matrixWorld, 0).multiplyScalar(p.radius + 1.6);
      shipTarget.current.set(...p.position).add(tmp);
      shipTarget.current.y += p.radius * 0.5;
    } else {
      c.getTarget(shipTarget.current);
      tmp.copy(c.camera.position).sub(shipTarget.current).multiplyScalar(0.22);
      shipTarget.current.add(tmp).y -= 3;
    }
  });

  return (
    <>
      <color attach="background" args={["#04050c"]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 0]} intensity={2} decay={0} />
      {flight ? (
        <FlightController pose={pose} setActive={setActive} planets={planets} visible={visible} onNear={props.onNear} onSelect={(i) => onSelect(i, false)} onSpeed={props.onSpeed} onTravelled={props.onTravelled} />
      ) : (
        <CameraControls
          ref={controls}
          makeDefault
          minDistance={4}
          maxDistance={340}
          smoothTime={0.55}
          draggingSmoothTime={0.15}
          dollySpeed={0.6}
          maxPolarAngle={Math.PI * 0.85}
        />
      )}
      <Starfield count={lowEffects ? 1500 : 4000} />
      <Dust count={lowEffects ? 7000 : 20000} theme={theme} seed={seed} clusters={props.clusters} />
      <CoreAndNebulae theme={theme} seed={seed} nebulae={!lowEffects} />
      <Planets planets={planets} visible={visible} lowEffects={lowEffects} hiddenIndex={selected} onHover={setHovered} onSelect={(i, travel) => onSelect(i, travel)} />
      <Connections planets={planets} visible={visible} selected={selected} overview={connections} />
      <Beacons planets={planets} visible={visible} accent={theme.accent} reducedMotion={reducedMotion} />
      {props.route && <Route planets={planets} indices={props.route.indices} active={props.route.active} accent={theme.accent} reducedMotion={reducedMotion} lowEffects={lowEffects} />}
      {selected != null && planets[selected] && (
        <PlanetSystem planet={planets[selected]} accent={theme.accent} reducedMotion={reducedMotion} lowEffects={lowEffects} scan={props.scan ?? null} scanning={!!props.scanning} />
      )}
      <LabelProjector labels={props.labels} els={props.labelEls} />
      <Ship target={shipTarget} pose={pose} accent={theme.accent} reducedMotion={reducedMotion} />
    </>
  );
}

export default function GalaxyScene(props: SceneProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const labelEls = useLabelEls();
  // Shared by the ship, the flight controller and the DOM radar.
  const pose = useRef<Pose>({ pos: new THREE.Vector3(0, 4, 120), quat: new THREE.Quaternion(), active: false, near: null });
  const setActive = useCallback((active: boolean) => void (pose.current.active = active), []);
  const { onNear: reportNear } = props;
  const onNear = useCallback((i: number | null) => {
    pose.current.near = i;
    reportNear(i);
  }, [reportNear]);
  const { planets, selected, regionLabels, onContextLost } = props;
  // Unmounting the canvas (e.g. switching to list view) also loses the context; that isn't a failure.
  const glRef = useRef<WebGLRenderer | null>(null);
  useLayoutEffect(() => () => glRef.current?.domElement.removeEventListener("webglcontextlost", onContextLost), [onContextLost]);
  const labels = useMemo(() => {
    const out: Label3D[] = regionLabels.map((r) => ({
      key: `region:${r.title}`,
      position: r.position,
      anchor: "center",
      hidden: selected != null,
      content: <div className="label whitespace-nowrap rounded-full border border-line bg-black/50 px-3 py-1 !text-[0.65rem] !text-muted">{r.title}</div>,
    }));
    for (const i of new Set([hovered, selected])) {
      const p = i != null ? planets[i] : null;
      if (!p) continue;
      out.push({
        key: `planet:${p.repo.id}`,
        position: [p.position[0], p.position[1] + p.radius + 0.8, p.position[2]],
        content: (
          <div className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium shadow-lg ${i === selected ? "bg-white text-black" : "glass text-text"}`}>{p.repo.fullName}</div>
        ),
      });
    }
    return out;
  }, [regionLabels, planets, hovered, selected]);

  return (
    <>
      <Canvas
        className="!absolute inset-0 touch-none"
        style={{ cursor: hovered != null ? "pointer" : "grab" }}
        dpr={[1, props.lowEffects ? 1.25 : 2]}
        camera={{ position: HOME.pos.toArray(), fov: 50, near: 0.5, far: 2500 }}
        gl={{ antialias: !props.lowEffects, powerPreference: "high-performance" }}
        // Reduced motion: render only when something changes.
        frameloop={props.reducedMotion && !props.flight ? "demand" : "always"}
        onCreated={({ gl }) => {
          glRef.current = gl;
          gl.domElement.addEventListener("webglcontextlost", onContextLost, { once: true });
        }}
        aria-label="3D galaxy view. Use the list view for a fully keyboard-accessible alternative."
        role="img"
      >
        <World {...props} onNear={onNear} setHovered={setHovered} labels={labels} labelEls={labelEls} pose={pose} setActive={setActive} />
      </Canvas>
      <LabelLayer labels={labels} els={labelEls} />
      {props.flight && <Radar planets={planets} visible={props.visible} selected={selected} pose={pose} accent={props.theme.accent} />}
    </>
  );
}
