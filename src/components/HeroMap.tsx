"use client";
import dynamic from "next/dynamic";

// Three.js loads after first paint; the painted gradient behind it covers the gap.
export const HeroMap = dynamic(() => import("@/components/scene/UniverseMap"), { ssr: false });
