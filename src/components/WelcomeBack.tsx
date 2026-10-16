"use client";
import { useEffect } from "react";
import { toast } from "@/components/explorer/Toasts";
import { scoreOf } from "@/lib/discovery/score";
import { full } from "@/lib/format";
import { explorerLog } from "@/lib/storage/log";

// Module-level so StrictMode's double effect (and remounts) can't count a second session or toast twice.
let started = false;

/** Mount once in the root layout. Starts the session and greets returning explorers. Renders nothing. */
export function WelcomeBack() {
  useEffect(() => {
    if (started) return;
    started = true;
    const { returning } = explorerLog.touchSession();
    const { xp, rank } = scoreOf(explorerLog.get());
    if (returning && xp > 0) toast.show({ tone: "info", icon: rank.emblem, title: `Welcome back, ${rank.name} — ${full(xp)} XP.`, body: "Today's missions are ready." });
  }, []);
  return null;
}
