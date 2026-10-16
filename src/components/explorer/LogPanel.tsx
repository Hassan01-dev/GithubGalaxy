"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { animate, stagger } from "animejs";
import { Sheet } from "@/components/explorer/Panels";
import { Icon } from "@/components/ui/Icon";
import { ACHIEVEMENTS } from "@/lib/discovery/achievements";
import { scoreOf } from "@/lib/discovery/score";
import { date, full, relative } from "@/lib/format";
import { languageColor } from "@/lib/galaxy/layout";
import { prefersReducedMotion } from "@/lib/motion";
import { explorerLog, useExplorerLog } from "@/lib/storage/log";
import { exportProgress, importProgress, MAX_BACKUP_BYTES } from "@/lib/storage/progress";

function backup() {
  const blob = new Blob([exportProgress()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `galaxy-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function LogPanel({ onClose }: { onClose: () => void }) {
  const log = useExplorerLog();
  const root = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const score = scoreOf(log);
  const unlocked = new Map(log.achievements.map((a) => [a.id, a.at]));
  const stats = [
    ["Planets visited", log.visits.length],
    ["Galaxies", new Set(log.visits.map((v) => v.galaxy)).size],
    ["Languages", new Set(log.visits.flatMap((v) => v.language ?? [])).size],
    ["Distance flown", Math.round(log.distanceFlown)],
    ["Journeys", log.journeysCompleted.length],
  ] as const;

  // Runs once on open. Final numbers are already rendered, so reduced motion (or no JS animation) shows the truth.
  useEffect(() => {
    if (prefersReducedMotion() || !root.current) return;
    for (const el of root.current.querySelectorAll<HTMLElement>("[data-count]")) {
      const n = Number(el.dataset.count);
      const text = el.firstChild; // Edit React's own text node, so later re-renders still land.
      const o = { n: 0 };
      if (text) animate(o, { n, duration: 900, ease: "outExpo", onUpdate: () => void (text.nodeValue = full(Math.round(o.n))) });
    }
    animate(root.current.querySelectorAll("[data-pop]"), { opacity: [0, 1], translateY: [8, 0], duration: 420, delay: stagger(35), ease: "outCubic" });
  }, []);

  return (
    <Sheet title="Explorer's Log" onClose={onClose}>
      <div ref={root} className="space-y-5">
        <section aria-labelledby="log-rank" className="rounded-xl border border-accent/30 p-4" style={{ background: "color-mix(in srgb, var(--accent) 6%, transparent)" }}>
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full border border-accent/50 text-2xl text-accent">{score.rank.emblem}</span>
            <div className="min-w-0 flex-1">
              <p className="label">Rank</p>
              <h3 id="log-rank" className="font-display text-lg font-semibold leading-tight">{score.rank.name}</h3>
              <p className="text-xs text-muted">{score.rank.description}</p>
            </div>
            <p className="shrink-0 text-right">
              <span className="block font-mono text-xl text-accent" data-count={score.xp}>{full(score.xp)}</span>
              <span className="label">XP</span>
            </p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={score.next ? `Progress to ${score.next.name}` : "Top rank reached"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(score.progress * 100)}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${score.progress * 100}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-faint">
            {score.next ? `${full(score.next.min - score.xp)} XP to ${score.next.name}` : "Top rank reached. Thanks for exploring."}
            {log.firstVisitAt && ` · Member since ${date(log.firstVisitAt)} · ${full(Math.max(1, log.sessions))} visit${log.sessions > 1 ? "s" : ""}`}
          </p>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs text-muted hover:text-text">How XP is earned</summary>
            <dl className="mt-2 space-y-1">
              {score.breakdown.map((b) => (
                <div key={b.label} className="flex justify-between gap-2 text-xs">
                  <dt className="text-muted">{b.label}</dt>
                  <dd className="font-mono">{full(b.xp)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-faint">10 per planet · 25 per language · 50 per galaxy · 100 per achievement · 75 per mission · 150 per journey · 1 per 100 units flown (max 500).</p>
          </details>
        </section>

        <p className="text-xs text-faint">Stored only in this browser (localStorage). Nothing is sent to a server, and there are no streaks to keep: explore at your own pace.</p>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map(([label, n]) => (
            <div key={label} className="rounded-xl border border-line p-3">
              <dt className="label">{label}</dt>
              <dd className="mt-1 font-mono text-xl" data-count={n}>{full(n)}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="log-achievements">
          <h3 id="log-achievements" className="label mb-2">Achievements · {unlocked.size}/{ACHIEVEMENTS.length}</h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ACHIEVEMENTS.map((a) => {
              const at = unlocked.get(a.id);
              return (
                <li key={a.id} data-pop className={`flex gap-3 rounded-xl border p-3 ${at ? "border-accent/40" : "border-line opacity-55"}`}>
                  <span aria-hidden className={`text-xl leading-none ${at ? "" : "grayscale"}`}>{a.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{a.title} <span className="sr-only">{at ? "(unlocked)" : "(locked)"}</span></span>
                    <span className="block text-xs text-muted">{a.description}</span>
                    {at && <span className="block text-xs text-faint">Unlocked {relative(at)}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="log-visits">
          <h3 id="log-visits" className="label mb-2">Recent visits</h3>
          {log.visits.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">No planets visited yet. Open one to start your log.</p>
          ) : (
            <ul className="space-y-1.5">
              {log.visits.slice(0, 25).map((v) => (
                <li key={v.fullName} className="flex items-center gap-2 rounded-lg border border-line p-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: languageColor(v.language) }} />
                  <Link className="min-w-0 flex-1 truncate text-sm hover:text-accent" href={`/repo/${v.fullName}`}>{v.fullName}</Link>
                  <span className="shrink-0 text-xs text-faint">{relative(v.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="log-backup">
          <h3 id="log-backup" className="label mb-2">Backup</h3>
          <p className="mb-2 text-xs text-faint">Clearing site data erases your progress. Save a backup file to keep it, or to move it to another device. Restoring merges with what&apos;s here.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn" onClick={backup}><Icon name="download" /> Back up progress</button>
            <button className="btn" onClick={() => file.current?.click()}><Icon name="upload" /> Restore from file</button>
          </div>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Progress backup file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              // Check before reading so a huge file is never loaded into memory.
              if (f.size > MAX_BACKUP_BYTES) return setNote({ ok: false, text: "That file is too large to be a progress backup." });
              const r = importProgress(await f.text());
              setNote(r.ok ? { ok: true, text: r.summary } : { ok: false, text: r.error });
            }}
          />
          {note && <p role="status" className={`mt-2 text-sm ${note.ok ? "text-positive" : "text-danger"}`}>{note.text}</p>}
        </section>

        <button className="btn w-full !text-danger" onClick={() => confirm("Clear your Explorer's Log (visits, distance, achievements, XP) from this browser? Back up first if you might want it later.") && explorerLog.reset()}>
          Clear log
        </button>
      </div>
    </Sheet>
  );
}
