import * as THREE from "three";
import { rng } from "@/lib/galaxy/layout";

/**
 * Planet surface styles, indexed by `PlacedPlanet.style` (order must match `planetSurface` in GLSL).
 * Decorative only: colour is the language, the style is not a claim about the repository.
 * clouds: detail-view cloud cover 0..1; atmo: atmosphere tint (mixed with the language colour); glow: shell strength, 0 = airless.
 */
export const PLANET_STYLES = [
  { name: "terran", clouds: 0.5, atmo: [0.45, 0.7, 1], glow: 1 },
  { name: "ocean", clouds: 0.4, atmo: [0.4, 0.75, 1], glow: 1 },
  { name: "volcanic", clouds: 0, atmo: [1, 0.4, 0.15], glow: 0.6 },
  { name: "ice giant", clouds: 0.15, atmo: [0.55, 0.85, 1], glow: 1 },
  { name: "gas giant", clouds: 0, atmo: [1, 0.85, 0.6], glow: 0.8 },
  { name: "toxic", clouds: 0.45, atmo: [0.75, 0.95, 0.3], glow: 1.1 },
  { name: "desert", clouds: 0.08, atmo: [1, 0.75, 0.5], glow: 0.6 },
  { name: "frozen moon", clouds: 0, atmo: [0.8, 0.9, 1], glow: 0 },
  { name: "crystalline", clouds: 0, atmo: [0.8, 0.7, 1], glow: 0.5 },
  { name: "metallic", clouds: 0, atmo: [0.7, 0.75, 0.85], glow: 0 },
  { name: "jungle", clouds: 0.55, atmo: [0.5, 0.9, 0.6], glow: 1 },
  { name: "cloud-veiled", clouds: 0.85, atmo: [1, 0.9, 0.65], glow: 1.2 },
  { name: "barren", clouds: 0, atmo: [0.7, 0.7, 0.75], glow: 0 },
] as const;

const ICE_GIANT = 3, GAS_GIANT = 4;

export interface PlanetVariant {
  /** [hue shift -1..1, band count/turbulence, crater density, ice-cap size], all 0..1 except hue. */
  vec: [number, number, number, number];
  /** Ring plane tilt (Euler x, z), or null for no rings. */
  ring: { tiltX: number; tiltZ: number } | null;
}

/** Per-planet variation within a style, derived only from the layout seed: same repo, same look. */
export function planetVariant(seed: number, style: number): PlanetVariant {
  const r = rng((Math.floor(seed * 2 ** 32) ^ 0x9e3779b9) >>> 0);
  const vec: PlanetVariant["vec"] = [r() * 2 - 1, r(), r(), r()];
  // Giants carry rings more often, like ours do. Overall ~15%.
  const giant = style === ICE_GIANT || style === GAS_GIANT;
  const ringed = r() < (giant ? 0.42 : 0.1);
  const tilt = () => (r() < 0.5 ? -1 : 1) * (0.2 + r() * 0.4);
  return { vec, ring: ringed ? { tiltX: tilt(), tiltZ: tilt() } : null };
}

export const RING_IN = 1.35;
export const RING_OUT = 2.3;

/** Value noise + fbm normalised to 0..1 so thresholds hold at any OCTAVES (overview vs detail look the same). */
const NOISE = /* glsl */ `
  float h31(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < OCTAVES; i++) { v += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
    return v / (1.0 - 2.0 * a);
  }
`;

const SURFACE = /* glsl */ `
  float ridge(float n) { return 1.0 - abs(2.0 * n - 1.0); }
  vec3 hueShift(vec3 c, float a) {
    const vec3 k = vec3(0.57735);
    float ca = cos(a);
    return max(c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca), 0.0);
  }
  // Round-ish pits with a raised rim; d = density 0..1.
  float craters(vec3 p, float d, out float rim) {
    float n = noise(p);
    float t = 0.78 - 0.18 * d;
    float pit = smoothstep(t, t + 0.06, n);
    rim = smoothstep(t - 0.06, t, n) - pit;
    return pit;
  }

  // o: unit-sphere point (object space). c: language colour. v: variant (hue, bands, craters, ice).
  void planetSurface(vec3 o, vec3 c, float seed, int s, vec4 v, out vec3 alb, out vec3 emit, out float spec, out float bump) {
    vec3 p = o * 2.2 + seed * 37.0;
    vec3 c2 = hueShift(c, v.x * 0.9);
    float n = fbm(p);
    float lat = o.y;
    float capEdge = 0.92 - 0.3 * v.w;
    float cap = smoothstep(capEdge, capEdge + 0.04, abs(lat) + (n - 0.5) * 0.25);
    float rim = 0.0;
    emit = vec3(0.0); spec = 0.0; bump = 0.0;
    if (s == 0) {         // terran: oceans, continents, polar caps
      float land = smoothstep(0.5, 0.53, n);
      vec3 sea = c * 0.32 + vec3(0.01, 0.03, 0.09);
      vec3 ground = mix(mix(vec3(0.16, 0.3, 0.1), c2, 0.45), vec3(0.5, 0.42, 0.3), smoothstep(0.62, 0.78, n));
      alb = mix(mix(sea, sea * 1.6, smoothstep(0.44, 0.5, n)), ground, land);
      alb = mix(alb, vec3(0.92, 0.95, 1.0), cap);
      spec = (1.0 - land) * (1.0 - cap);
      bump = land * 0.7;
    } else if (s == 1) {  // ocean world with island chains
      float m = fbm(p * 1.7 + 5.0);
      float isl = smoothstep(0.66, 0.69, m);
      vec3 sea = mix(c * 0.25, c * 0.5, n) + vec3(0.0, 0.02, 0.06);
      alb = mix(sea, mix(c, vec3(0.6, 0.85, 0.85), 0.5), smoothstep(0.6, 0.66, m) * 0.6);
      alb = mix(alb, mix(vec3(0.75, 0.68, 0.45), c2 * 0.6, 0.5), isl);
      alb = mix(alb, vec3(0.9, 0.95, 1.0), cap * 0.8);
      spec = 1.0 - isl;
      bump = isl * 0.5;
    } else if (s == 2) {  // volcanic: dark crust, glowing cracks
      float r = ridge(fbm(p * 1.4 + 3.0));
      float crack = smoothstep(0.86, 0.96, r);
      alb = mix(vec3(0.05, 0.04, 0.04), c * 0.18, n) * (1.0 - crack * 0.5);
      emit = mix(vec3(1.0, 0.32, 0.04), c2, 0.3) * (crack * 1.6 + smoothstep(0.7, 0.8, n) * 0.5);
      bump = 0.9;
    } else if (s == 3) {  // ice giant: soft bands, faint storm
      float b = sin(lat * (5.0 + 7.0 * v.y) + fbm(p * vec3(0.6, 1.8, 0.6)) * 1.6);
      alb = mix(mix(c, vec3(0.7, 0.9, 1.0), 0.45) * 0.75, mix(c, vec3(0.92, 0.97, 1.0), 0.6), 0.5 + 0.35 * b);
      vec3 sd = normalize(vec3(cos(seed * 40.0), (v.y - 0.5) * 0.9, sin(seed * 40.0)));
      alb = mix(alb, vec3(0.95, 0.98, 1.0), smoothstep(0.985, 0.996, dot(normalize(vec3(o.x, o.y * 2.0, o.z)), sd)) * 0.6);
    } else if (s == 4) {  // gas giant: turbulent bands, great storm
      float t = fbm(p * vec3(0.5, 2.6, 0.5));
      float b = sin(lat * (11.0 + 9.0 * v.y) + t * (2.0 + 3.0 * v.y));
      alb = mix(c * 0.45, mix(c2, vec3(0.95, 0.86, 0.7), 0.5), 0.5 + 0.5 * b) * (0.85 + 0.3 * t);
      vec3 sd = normalize(vec3(cos(seed * 50.0), -0.35 + 0.2 * v.z, sin(seed * 50.0)));
      float d = dot(normalize(vec3(o.x, o.y * 2.4, o.z)), sd);
      alb = mix(alb, vec3(0.95, 0.88, 0.78), smoothstep(0.96, 0.97, d) - smoothstep(0.97, 0.975, d));
      alb = mix(alb, mix(c2, vec3(0.75, 0.3, 0.18), 0.55), smoothstep(0.975, 0.99, d));
    } else if (s == 5) {  // toxic: acid haze
      float w = fbm(p * 0.8 + vec3(n * 3.0));
      vec3 base = mix(vec3(0.62, 0.78, 0.12), c, 0.45);
      alb = mix(base * 0.35, mix(base, vec3(0.95, 1.0, 0.6), 0.3), w);
      emit = base * 0.06;
      bump = 0.1;
    } else if (s == 6) {  // desert canyons and dunes
      float r = ridge(fbm(p * 1.2 + 7.0));
      float canyon = smoothstep(0.88, 0.97, r);
      vec3 sand = mix(vec3(0.8, 0.6, 0.38), c, 0.4) * (0.78 + 0.35 * n + 0.06 * sin(dot(o, vec3(23.0, 5.0, 17.0)) + n * 9.0));
      alb = mix(sand, sand * vec3(0.45, 0.35, 0.3), canyon);
      alb = mix(alb, vec3(0.9, 0.9, 0.92), cap * 0.6 * step(0.5, v.w));
      bump = 0.8;
    } else if (s == 7) {  // frozen, cratered moon
      float rim2 = 0.0;
      float pit = craters(p * 2.5, v.z, rim);
      float pit2 = craters(p * 6.0 + 2.0, v.z, rim2);
      alb = mix(vec3(0.78, 0.8, 0.85), c, 0.28) * (0.72 + 0.35 * n);
      alb = alb * (1.0 - 0.3 * max(pit, pit2 * 0.7)) + 0.12 * (rim + rim2 * 0.6);
      spec = 0.25;
      bump = 1.0;
    } else if (s == 8) {  // crystalline facets
      float f = floor(n * 7.0) / 7.0;
      alb = mix(c * 0.4, mix(c2, vec3(1.0), 0.5), f);
      emit = c2 * 0.25 * smoothstep(0.75, 0.9, f);
      spec = 1.0;
      bump = 0.4;
    } else if (s == 9) {  // metallic: brushed streaks, rust patches
      float streak = noise(vec3(p.x * 0.4, o.y * 40.0, p.z * 0.4));
      alb = mix(vec3(0.34, 0.36, 0.4), c, 0.3) * (0.7 + 0.35 * streak);
      alb = mix(alb, mix(c2, vec3(0.45, 0.2, 0.08), 0.6) * 0.7, smoothstep(0.6, 0.7, n) * v.z);
      spec = 0.9;
      bump = 0.35;
    } else if (s == 10) { // jungle with rivers
      float river = smoothstep(0.95, 0.99, ridge(noise(p * 2.2 + 11.0)));
      alb = mix(vec3(0.07, 0.26, 0.08), c, 0.35) * (0.6 + 0.6 * n);
      alb = mix(alb, c * 0.3 + vec3(0.02, 0.05, 0.1), river);
      spec = river;
      bump = 0.5;
    } else if (s == 11) { // cloud-veiled
      float w = fbm(p * vec3(1.0, 2.6, 1.0) + vec3(n * 2.0));
      alb = mix(vec3(0.92, 0.84, 0.62), c, 0.4) * (0.7 + 0.4 * w);
    } else {              // barren rock
      float pit = craters(p * 3.0, v.z * 0.6, rim);
      alb = mix(c * 0.28, c * 0.85, smoothstep(0.3, 0.75, n));
      alb = alb * (1.0 - 0.3 * pit) + 0.08 * rim;
      bump = 0.8;
    }
  }

  // Lit by the galactic core (L), plus a view fill so the night side stays readable, and a rim.
  vec3 planetLight(vec3 alb, vec3 emit, float spec, vec3 N, vec3 V, vec3 L, vec3 c, float rimK) {
    float diff = max(dot(N, L), 0.0);
    float nv = max(dot(N, V), 0.0);
    float fill = 0.22 + 0.25 * nv;
    float rim = pow(1.0 - nv, 3.0);
    float glint = pow(max(dot(N, normalize(L + V)), 0.0), 64.0) * spec * diff;
    // Emission reads strongest in shadow: lava seen from the night side.
    return alb * (diff * 0.95 + fill) + mix(c, vec3(1.0), 0.4) * rim * 0.55 * rimK
      + vec3(0.9, 0.95, 1.0) * glint * 0.45 + emit * (1.0 - 0.5 * diff);
  }
`;

// Instanced (overview) and single-mesh (detail) share one shader: per-planet data is an instanced
// attribute in one and a uniform of the same name in the other.
const planetVertex = /* glsl */ `
  #ifdef USE_INSTANCING
    attribute float aSeed;
    attribute float aStyle;
    attribute vec4 aVariant;
    uniform float uHover;
  #else
    uniform float aSeed;
    uniform float aStyle;
    uniform vec4 aVariant;
  #endif
  uniform vec3 uColor;
  varying vec3 vObj;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  varying vec3 vColor;
  varying float vSeed;
  varying float vStyle;
  varying vec4 vVariant;
  varying float vHover;
  void main() {
    vObj = position;
    #ifdef USE_INSTANCING
      mat4 mw = modelMatrix * instanceMatrix;
      vHover = float(gl_InstanceID) == uHover ? 1.0 : 0.0;
    #else
      mat4 mw = modelMatrix;
      vHover = 0.0;
    #endif
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = uColor;
    #endif
    vec4 w = mw * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormalW = normalize(mat3(mw) * normal);
    vSeed = aSeed;
    vStyle = aStyle;
    vVariant = aVariant;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const planetFragment = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  varying vec3 vColor;
  varying float vSeed;
  varying float vStyle;
  varying vec4 vVariant;
  varying float vHover;
  ${NOISE}
  ${SURFACE}
  #ifdef DETAIL
    uniform mat4 modelMatrix; // set by three for every program; the fragment prefix just doesn't declare it
    float relief(vec3 o) {
      vec3 p = o * 9.0 + vSeed * 53.0;
      return noise(p) * 0.6 + noise(p * 2.3) * 0.3 + noise(p * 5.1) * 0.1;
    }
  #endif
  void main() {
    vec3 o = normalize(vObj);
    vec3 alb, emit;
    float spec, bump;
    planetSurface(o, vColor, vSeed, int(vStyle + 0.5), vVariant, alb, emit, spec, bump);
    vec3 N = normalize(vNormalW);
    #ifdef DETAIL
      // Fake relief: perturb the normal by the gradient of a fine height field (tangent part only).
      float e = 0.002;
      float h0 = relief(o);
      vec3 g = (vec3(relief(o + vec3(e, 0.0, 0.0)), relief(o + vec3(0.0, e, 0.0)), relief(o + vec3(0.0, 0.0, e))) - h0) / e;
      g -= dot(g, o) * o;
      N = normalize(mat3(modelMatrix) * normalize(o - g * bump * 0.025));
    #endif
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 L = normalize(-vWorld);
    gl_FragColor = vec4(planetLight(alb, emit, spec, N, V, L, vColor, 1.0 + 1.5 * vHover), 1.0);
    #include <colorspace_fragment>
  }
`;

export function planetMaterial(octaves: number, detail = false, hover: { value: number } = { value: -1 }) {
  return new THREE.ShaderMaterial({
    defines: detail ? { OCTAVES: octaves, DETAIL: "" } : { OCTAVES: octaves },
    uniforms: {
      uHover: hover,
      uColor: { value: new THREE.Color() },
      aSeed: { value: 0 },
      aStyle: { value: 0 },
      aVariant: { value: new THREE.Vector4() },
    },
    vertexShader: planetVertex,
    fragmentShader: planetFragment,
  });
}

const shellVertex = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  void main() {
    vObj = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

/** Streaky cloud deck; thins on the night side so city lights show through. */
export function cloudMaterial(seed: number, cover: number, tint: THREE.Color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    defines: { OCTAVES: 4 },
    uniforms: { uSeed: { value: seed }, uCover: { value: cover }, uTint: { value: tint } },
    vertexShader: shellVertex,
    fragmentShader: /* glsl */ `
      uniform float uSeed;
      uniform float uCover;
      uniform vec3 uTint;
      varying vec3 vObj;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      ${NOISE}
      void main() {
        vec3 o = normalize(vObj);
        vec3 p = o * vec3(3.0, 6.0, 3.0) + uSeed * 23.0;
        float d = fbm(p + vec3(fbm(p * 0.5) * 2.0));
        float t = mix(0.72, 0.38, uCover);
        float a = smoothstep(t, t + 0.18, d) * mix(0.55, 0.95, uCover);
        vec3 N = normalize(vNormalW);
        float nl = dot(N, normalize(-vWorld));
        a *= 0.3 + 0.7 * smoothstep(-0.2, 0.3, nl);
        gl_FragColor = vec4(uTint * (0.12 + max(nl, 0.0) * 0.95), a);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Additive back-face shell: brightest at the planet's limb, fading outward, stronger on the day side. */
export function atmosphereMaterial(tint: THREE.Color, strength: number, shellScale: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    // -dot(N, V) where the planet's limb sits inside the shell.
    uniforms: { uTint: { value: tint }, uStrength: { value: strength }, uLimb: { value: Math.sqrt(1 - 1 / shellScale ** 2) } },
    vertexShader: shellVertex,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint;
      uniform float uStrength;
      uniform float uLimb;
      varying vec3 vObj;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vWorld);
        float k = smoothstep(0.0, uLimb, -dot(N, V));
        float day = 0.2 + 0.8 * smoothstep(-0.35, 0.5, dot(N, normalize(-vWorld)));
        gl_FragColor = vec4(uTint * k * k * day * uStrength, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Banded, gapped rings in planet-radius units (geometry in the XZ plane). Instanced or single. */
export function ringMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color() }, aSeed: { value: 0 } },
    vertexShader: /* glsl */ `
      #ifdef USE_INSTANCING
        attribute float aSeed;
      #else
        uniform float aSeed;
      #endif
      uniform vec3 uColor;
      varying float vT;
      varying float vSeed;
      varying vec3 vColor;
      varying vec3 vWorld;
      varying vec3 vCenter;
      varying float vRad;
      varying vec3 vNr;
      void main() {
        #ifdef USE_INSTANCING
          mat4 mw = modelMatrix * instanceMatrix;
        #else
          mat4 mw = modelMatrix;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #else
          vColor = uColor;
        #endif
        vT = (length(position.xz) - ${RING_IN.toFixed(3)}) / ${(RING_OUT - RING_IN).toFixed(3)};
        vSeed = aSeed;
        vec4 w = mw * vec4(position, 1.0);
        vWorld = w.xyz;
        vCenter = (mw * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vRad = length(mw[0].xyz); // ring is scaled by the planet radius
        vNr = normalize(mat3(mw) * vec3(0.0, 1.0, 0.0));
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vT;
      varying float vSeed;
      varying vec3 vColor;
      varying vec3 vWorld;
      varying vec3 vCenter;
      varying float vRad;
      varying vec3 vNr;
      float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
      float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h11(i), h11(i + 1.0), f); }
      void main() {
        float t = vT;
        float s = vSeed * 91.0;
        float b = n1(t * 14.0 + s) * 0.55 + n1(t * 37.0 + s * 1.3) * 0.3 + n1(t * 80.0 + s * 0.7) * 0.15;
        float gap = smoothstep(0.015, 0.035, abs(t - (0.55 + 0.2 * fract(s))));
        float a = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.8, 1.0, t)) * gap * (0.15 + 0.85 * b);
        // The planet's shadow across the rings.
        vec3 L = normalize(-vWorld);
        vec3 toC = vCenter - vWorld;
        float along = dot(toC, L);
        float shadow = 1.0 - 0.8 * step(0.0, along) * (1.0 - smoothstep(vRad * 0.95, vRad * 1.02, length(toC - L * along)));
        float lit = (0.35 + 0.65 * abs(dot(vNr, L))) * shadow;
        gl_FragColor = vec4(mix(vColor, vec3(0.92, 0.86, 0.74), 0.45) * (0.6 + 0.5 * b) * lit, a * 0.85);
        #include <colorspace_fragment>
      }
    `,
  });
}
