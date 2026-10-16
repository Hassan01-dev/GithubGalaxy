"use client";
import { useId, useLayoutEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { usePlanetScan } from "@/hooks/usePlanetScan";
import { date, full, relative } from "@/lib/format";
import { languageColor } from "@/lib/galaxy/layout";
import { safeUrl } from "@/lib/url";
import { prefersReducedMotion } from "@/lib/motion";
import type { PlanetScan } from "@/types";

/** GitHub links at most 500 author emails to accounts, so counts at the cap are a floor. */
export const CONTRIBUTOR_CAP = 500;
const YEAR_MS = 365 * 86_400_000;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function activityPulse(weekly: number[]) {
  return { last12: sum(weekly.slice(-12)), prior12: sum(weekly.slice(-24, -12)), total: sum(weekly), max: Math.max(1, ...weekly) };
}

/** Largest languages by bytes; the long tail is folded into "Other" so the bar stays readable. */
export function languageShares(languages: PlanetScan["languages"], slices = 6) {
  const total = sum(languages.map((l) => l.bytes));
  if (!total) return [];
  const head = languages.slice(0, slices).map((l) => ({ ...l, color: languageColor(l.name) }));
  const rest = sum(languages.slice(slices).map((l) => l.bytes));
  if (rest) head.push({ name: "Other", bytes: rest, color: "#5b6178" });
  return head.map((l) => ({ ...l, pct: (l.bytes / total) * 100 }));
}

export const formatPct = (pct: number) => (pct > 0 && pct < 0.1 ? "<0.1%" : `${pct.toFixed(1)}%`);

const REASONS: Record<string, string> = {
  rate_limited: "GitHub's hourly limit for anonymous requests is used up. Try again later.",
  not_found: "GitHub has no public repository by this name.",
  offline: "Couldn't reach GitHub right now.",
};

export function PlanetScanPanel({ fullName, accent = "var(--accent)" }: { fullName: string; accent?: string }) {
  const { scan, state, reason } = usePlanetScan(fullName);
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} aria-busy={state === "scanning"}>
      <h3 id={titleId} className="label mb-2 flex items-center justify-between gap-2">
        Planet scan
        {scan && <span className="font-normal tracking-normal normal-case">scanned {relative(scan.scannedAt)}</span>}
      </h3>
      {state === "scanning" && <Scanning accent={accent} />}
      {state === "unavailable" && (
        <p className="rounded-lg border border-line bg-white/[0.03] px-3 py-2.5 text-sm text-muted">Scan unavailable. {REASONS[reason ?? "offline"] ?? REASONS.offline}</p>
      )}
      {scan && <Results scan={scan} accent={accent} />}
    </section>
  );
}

function Scanning({ accent }: { accent: string }) {
  const line = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!line.current || prefersReducedMotion()) return;
    const a = animate(line.current, { top: ["0%", "100%"], duration: 1600, loop: true, alternate: true, ease: "inOutSine" });
    return () => void a.revert();
  }, []);
  return (
    <div className="relative h-28 overflow-hidden rounded-lg border border-line bg-white/[0.03]" style={{ backgroundImage: "linear-gradient(var(--line) 1px, transparent 1px)", backgroundSize: "100% 14px" }}>
      <div ref={line} aria-hidden className="absolute inset-x-0 top-1/2 h-px" style={{ background: accent, boxShadow: `0 0 12px 2px ${accent}` }} />
      <p role="status" className="absolute inset-0 grid place-items-center font-mono text-xs tracking-widest text-muted uppercase">Scanning planet…</p>
    </div>
  );
}

function Results({ scan, accent }: { scan: PlanetScan; accent: string }) {
  const count = useRef<HTMLSpanElement>(null);
  const avatars = useRef<HTMLUListElement>(null);
  const langBar = useRef<HTMLDivElement>(null);
  const spark = useRef<SVGGElement>(null);

  const capped = scan.contributorsCount !== null && scan.contributorsCount >= CONTRIBUTOR_CAP;
  const pulse = scan.weeklyCommits && activityPulse(scan.weeklyCommits);
  const shares = languageShares(scan.languages);
  const scannedMs = Date.parse(scan.scannedAt);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const anims: { revert: () => unknown }[] = [];
    const n = scan.contributorsCount;
    if (count.current && n) {
      const el = count.current;
      const o = { n: 0 };
      el.textContent = "0";
      anims.push(animate(o, { n, duration: 1200, ease: "outExpo", onUpdate: () => void (el.textContent = full(Math.round(o.n))) }));
    }
    if (avatars.current?.children.length)
      anims.push(animate(Array.from(avatars.current.children), { opacity: [0, 1], translateY: [8, 0], scale: [0.6, 1], duration: 500, delay: stagger(45), ease: "outBack" }));
    if (langBar.current?.children.length) anims.push(animate(Array.from(langBar.current.children), { scaleX: [0, 1], duration: 700, delay: stagger(70), ease: "outQuart" }));
    if (spark.current?.children.length) anims.push(animate(Array.from(spark.current.children), { scaleY: [0, 1], duration: 400, delay: stagger(14), ease: "outQuad" }));
    return () => anims.forEach((a) => a.revert());
  }, [scan]);

  return (
    <div className="space-y-5">
      {scan.partial && <p className="text-xs text-caution">Some parts of this scan couldn&apos;t be fetched from GitHub, so empty sections may be incomplete.</p>}

      <div>
        <h4 className="label mb-1.5">Population</h4>
        {scan.contributorsCount !== null ? (
          <p className="text-sm text-muted">
            <span ref={count} className="font-mono text-2xl text-text tabular-nums">{full(scan.contributorsCount)}</span>
            {capped && <span className="font-mono text-2xl text-text">+</span>} contributor{scan.contributorsCount === 1 ? "" : "s"}
          </p>
        ) : (
          <p className="text-sm text-faint italic">{scan.partial ? "Contributor count unavailable right now." : "GitHub doesn't list contributors for a history this large."}</p>
        )}
        {scan.topContributors.length > 0 && (
          <ul ref={avatars} className="mt-2 flex flex-wrap -space-x-2" aria-label="Top contributors">
            {scan.topContributors.map((c) => {
              const href = safeUrl(c.htmlUrl);
              const label = `${c.login} · ${full(c.contributions)} commits`;
              const img = c.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- tiny external avatars; no optimisation needed
                <img src={avatarSized(c.avatarUrl)} alt={c.login} width={32} height={32} loading="lazy" className="size-8 rounded-full bg-white/10 ring-2 ring-panel-solid" />
              ) : (
                <span className="grid size-8 place-items-center rounded-full bg-white/10 text-xs uppercase ring-2 ring-panel-solid" role="img" aria-label={c.login}>{c.login[0]}</span>
              );
              return (
                <li key={c.login} title={label}>
                  {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="block rounded-full transition-transform hover:z-10 hover:-translate-y-0.5">{img}</a> : img}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-faint">
          Contributors = population: everyone with commits on the default branch linked to a GitHub account.
          {capped && ` GitHub links at most ${CONTRIBUTOR_CAP} of them, so the real number is higher.`}
        </p>
      </div>

      <div>
        <h4 className="label mb-1.5">Activity pulse</h4>
        {pulse ? (
          <>
            <svg viewBox="0 0 208 40" preserveAspectRatio="none" className="h-12 w-full" role="img" aria-label={`Weekly commits over the last 52 weeks: ${full(pulse.total)} in total`}>
              <g ref={spark} fill={accent}>
                {scan.weeklyCommits!.map((v, i) => (
                  <rect key={i} x={i * 4} width={3} y={40 - barHeight(v, pulse.max)} height={barHeight(v, pulse.max)} rx={0.5} opacity={i >= 40 ? 1 : 0.55} style={{ transformBox: "fill-box", transformOrigin: "bottom" }} />
                ))}
              </g>
            </svg>
            <p className="mt-1 text-sm text-muted">
              <span className="font-mono text-text tabular-nums">{full(pulse.last12)}</span> commits in the last 12 weeks vs <span className="font-mono tabular-nums">{full(pulse.prior12)}</span> in the 12 before.
            </p>
          </>
        ) : (
          <p className="text-sm text-faint italic">GitHub is still computing commit stats — try again in a minute.</p>
        )}
      </div>

      <div>
        <h4 className="label mb-1.5">Composition</h4>
        {shares.length ? (
          <>
            <div ref={langBar} className="flex h-2.5 gap-px overflow-hidden rounded-full bg-white/[0.05]" role="img" aria-label={shares.map((s) => `${s.name} ${formatPct(s.pct)}`).join(", ")}>
              {shares.map((s) => (
                <span key={s.name} className="h-full origin-left" style={{ width: `${s.pct}%`, background: s.color }} />
              ))}
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {shares.map((s) => (
                <li key={s.name} className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate">{s.name}</span>
                  <span className="ml-auto font-mono text-faint tabular-nums">{formatPct(s.pct)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-faint italic">GitHub detected no languages in this repository.</p>
        )}
      </div>

      <div>
        <h4 className="label mb-1.5">Satellites</h4>
        {scan.releases.length ? (
          <ol className="space-y-1.5 border-l border-line pl-3 text-sm">
            {scan.releases.map((r) => {
              const href = safeUrl(r.htmlUrl);
              const recent = scannedMs - Date.parse(r.publishedAt) < YEAR_MS;
              return (
                <li key={r.tag} className="relative flex items-baseline justify-between gap-3">
                  <span aria-hidden className={`absolute top-1.5 -left-[15.5px] size-1.5 rounded-full ${recent ? "" : "bg-faint"}`} style={recent ? { background: accent } : undefined} />
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className={`truncate font-mono underline-offset-2 hover:underline ${recent ? "" : "text-muted"}`}>{r.tag}</a>
                  ) : (
                    <span className="truncate font-mono">{r.tag}</span>
                  )}
                  <span className="shrink-0 text-xs text-faint">{date(r.publishedAt)}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-faint italic">No published releases.</p>
        )}
        <p className="mt-2 text-xs text-faint">Each satellite orbiting this planet is a release from the last 12 months. Older releases are dimmed.</p>
      </div>
    </div>
  );
}

const barHeight = (v: number, max: number) => (v ? Math.max(1.5, (v / max) * 40) : 0.5);

function avatarSized(url: string) {
  const u = new URL(url);
  u.searchParams.set("s", "64");
  return u.toString();
}
