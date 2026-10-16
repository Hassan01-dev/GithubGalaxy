"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useFavorites } from "@/hooks/useStores";
import { signals } from "@/lib/discovery/signals";
import { compact, date, full } from "@/lib/format";
import { Ago, useNow } from "@/components/ui/Ago";
import { languageColor } from "@/lib/galaxy/layout";
import { favorites } from "@/lib/storage/favorites";
import type { Repository } from "@/types";
import type { RepoResult } from "@/lib/data/repo";

/** Release info and fresher counts live behind /api/repo; fetched once per repo per session. */
const detailCache = new Map<string, Promise<RepoResult | null>>();
function fetchDetail(fullName: string) {
  if (!detailCache.has(fullName))
    detailCache.set(fullName, fetch(`/api/repo/${fullName}`).then((r) => r.json() as Promise<RepoResult>).catch(() => (detailCache.delete(fullName), null)));
  return detailCache.get(fullName)!;
}

/** Merges server detail (release, fresher counts) over the galaxy's copy. */
export function useRepoDetail(repo: Repository, enrich: boolean) {
  const [detail, setDetail] = useState<{ for: string; repo: Repository } | null>(null);
  useEffect(() => {
    if (!enrich) return;
    let live = true;
    fetchDetail(repo.fullName).then((r) => live && r?.status === "ok" && setDetail({ for: repo.fullName, repo: r.repo }));
    return () => void (live = false);
  }, [repo.fullName, enrich]);
  const d = detail?.for === repo.fullName ? detail.repo : null;
  return { repo: d ? { ...repo, ...d, starGrowth: d.starGrowth ?? repo.starGrowth } : repo, releaseChecked: !!d };
}

function Stat({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white/[0.03] px-3 py-2" title={title}>
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 font-mono text-base tabular-nums">{value}</dd>
    </div>
  );
}

export function CopyLinkButton({ path, label = "Copy link" }: { path: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const url = typeof window === "undefined" ? path : new URL(path, window.location.origin).toString();
  return (
    <>
      <button
        className="btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setState("copied");
            setTimeout(() => setState("idle"), 1800);
          } catch {
            setState("failed");
          }
        }}
      >
        <Icon name="link" /> <span aria-live="polite">{state === "copied" ? "Copied" : label}</span>
      </button>
      {state === "failed" && (
        <input readOnly value={url} className="field col-span-full font-mono text-xs" aria-label="Link to copy" onFocus={(e) => e.currentTarget.select()} autoFocus />
      )}
    </>
  );
}

export function RepoDetails({ repo, releaseChecked, regionNote, actions }: { repo: Repository; releaseChecked: boolean; regionNote?: string; actions?: React.ReactNode }) {
  const favs = useFavorites();
  const saved = favs.repos.some((r) => r.fullName === repo.fullName);
  const now = useNow();
  // Before hydration, judge recency against fetch time so server and client agree.
  const sig = signals(repo, now ?? Date.parse(repo.fetchedAt));

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted">{repo.owner} /</p>
        <h2 className="font-display text-2xl leading-tight font-semibold break-words">{repo.name}</h2>
        {repo.description ? <p className="mt-2 text-sm leading-relaxed text-muted">{repo.description}</p> : <p className="mt-2 text-sm text-faint italic">No description provided.</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {repo.language && (
            <span className="chip">
              <span className="size-2 rounded-full" style={{ background: languageColor(repo.language) }} /> {repo.language}
            </span>
          )}
          {repo.license && <span className="chip">{repo.license}</span>}
          {repo.archived && <span className="chip !text-caution">Archived</span>}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Stars" value={compact(repo.stars)} title={full(repo.stars)} />
        <Stat label="Forks" value={compact(repo.forks)} title={full(repo.forks)} />
        <Stat label="Open issues + PRs" value={compact(repo.openIssues)} title="GitHub counts open issues and pull requests together. Not a bug count." />
        <Stat label="Last push" value={<Ago iso={repo.pushedAt} />} title={repo.pushedAt} />
      </dl>

      <div className="grid grid-cols-2 gap-2">
        <a className="btn btn-primary col-span-2" href={repo.htmlUrl} target="_blank" rel="noopener noreferrer">
          Open on GitHub <Icon name="external" />
        </a>
        <button className="btn" aria-pressed={saved} onClick={() => favorites.toggle(repo)}>
          <Icon name="heart" filled={saved} className={`size-4 ${saved ? "text-accent" : ""}`} /> {saved ? "Saved" : "Save planet"}
        </button>
        <CopyLinkButton path={`/repo/${repo.fullName}`} />
        {actions}
      </div>

      {sig.length > 0 && (
        <section>
          <h3 className="label mb-2">Why it&apos;s interesting</h3>
          <ul className="space-y-1.5 text-sm">
            {sig.map((s) => (
              <li key={s.text} className="flex gap-2">
                <span aria-hidden className={`mt-1.5 size-1.5 shrink-0 rounded-full ${s.tone === "positive" ? "bg-positive" : s.tone === "caution" ? "bg-caution" : "bg-faint"}`} />
                <span className={s.tone === "caution" ? "text-caution" : "text-text/90"}>{s.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-faint">Facts from public GitHub metadata. They don&apos;t guarantee quality, security, or future maintenance.</p>
        </section>
      )}

      {regionNote && (
        <section>
          <h3 className="label mb-1">Why it&apos;s in this galaxy</h3>
          <p className="text-sm text-muted">{regionNote}</p>
        </section>
      )}

      {repo.topics.length > 0 && (
        <section>
          <h3 className="label mb-2">Topics</h3>
          <div className="flex flex-wrap gap-1.5">
            {repo.topics.map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-1 text-sm">
        <h3 className="label mb-2">Details</h3>
        <Row k="Created" v={date(repo.createdAt)} />
        <Row k="Latest release" v={repo.latestRelease ? `${repo.latestRelease.tag} · ${date(repo.latestRelease.publishedAt)}` : releaseChecked ? "None published" : "Checking…"} />
        {repo.defaultBranch && <Row k="Default branch" v={repo.defaultBranch} />}
        {repo.homepage && (
          <Row
            k="Website"
            v={
              <a className="text-accent underline-offset-2 hover:underline break-all" href={repo.homepage} target="_blank" rel="noopener noreferrer nofollow">
                {repo.homepage.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            }
          />
        )}
      </section>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-faint">
        <span>Data fetched <Ago iso={repo.fetchedAt} /> from GitHub, the source of truth.</span>
        <a className="underline-offset-2 hover:underline" href={`${repo.htmlUrl}#readme`} target="_blank" rel="noopener noreferrer">
          README
        </a>
        <a className="underline-offset-2 hover:underline" href={repo.htmlUrl} target="_blank" rel="noopener noreferrer" title="We mirror GitHub's metadata. If it looks wrong here, check the repository itself.">
          Data looks wrong?
        </a>
      </footer>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 py-1.5 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
