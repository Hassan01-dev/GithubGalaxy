"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { useFavorites, useSettings } from "@/hooks/useStores";
import { EMPTY_FILTERS, facet, type Filters } from "@/lib/discovery/filters";
import { compact } from "@/lib/format";
import { Ago } from "@/components/ui/Ago";
import { languageColor, MAX_RADIUS, MIN_RADIUS } from "@/lib/galaxy/layout";
import { favorites } from "@/lib/storage/favorites";
import { settings } from "@/lib/storage/settings";
import type { DataSource, GalaxyRegion, Repository } from "@/types";

export function Sheet({ title, onClose, children, className = "" }: { title: string; onClose: () => void; children: React.ReactNode; className?: string }) {
  return (
    <section
      role="dialog"
      aria-label={title}
      className={`glass scroll-thin pointer-events-auto flex max-h-full flex-col overflow-hidden rounded-2xl shadow-2xl ${className}`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        <button className="btn btn-icon !min-h-9 !w-9" onClick={onClose} aria-label={`Close ${title}`}>
          <Icon name="x" />
        </button>
      </header>
      <div className="scroll-thin overflow-y-auto overscroll-contain p-4">{children}</div>
    </section>
  );
}

const STAR_STEPS = [0, 50, 100, 500, 1000, 5000, 10000];
const UPDATED_STEPS = [null, 1, 3, 7, 30];

export function FilterPanel({ filters, setFilters, repos, regions, regionNoun, shown, total, onClose }: {
  filters: Filters; setFilters: (f: Filters) => void; repos: Repository[]; regions: GalaxyRegion[]; regionNoun: string; shown: number; total: number; onClose: () => void;
}) {
  const languages = useMemo(() => facet(repos, (r) => r.language), [repos]);
  const topics = useMemo(() => facet(repos, (r) => r.topics, 60), [repos]);
  const licenses = useMemo(() => facet(repos, (r) => r.license), [repos]);
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const select = (label: string, value: string | null, options: { value: string; count: number }[], key: "language" | "topic" | "license") => (
    <label className="block">
      <span className="label">{label}</span>
      <select className="field mt-1" value={value ?? ""} onChange={(e) => set({ [key]: e.target.value || null })}>
        <option value="">Any</option>
        {value && !options.some((o) => o.value === value) && <option value={value}>{value} (0)</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.value} ({o.count})</option>
        ))}
      </select>
    </label>
  );

  return (
    <Sheet title="Filters" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted" aria-live="polite">
          Showing <strong className="text-text">{shown}</strong> of {total} planets
        </p>
        <fieldset>
          <legend className="label mb-1.5">{regionNoun}</legend>
          <div className="flex flex-wrap gap-1.5">
            {[{ slug: null, title: "All" }, ...regions].map((r) => (
              <button key={r.slug ?? "all"} className={`btn !min-h-8 !px-3 text-xs ${filters.region === r.slug ? "!border-accent !text-accent" : ""}`} aria-pressed={filters.region === r.slug} onClick={() => set({ region: r.slug })}>
                {r.title}
              </button>
            ))}
          </div>
        </fieldset>
        {select("Language", filters.language, languages, "language")}
        {select("Topic", filters.topic, topics, "topic")}
        {select("License", filters.license, licenses, "license")}
        <label className="block">
          <span className="label">Minimum stars</span>
          <select className="field mt-1" value={filters.minStars} onChange={(e) => set({ minStars: Number(e.target.value) })}>
            {STAR_STEPS.map((s) => <option key={s} value={s}>{s ? `${compact(s)}+` : "Any"}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Pushed to within</span>
          <select className="field mt-1" value={filters.updatedWithin ?? ""} onChange={(e) => set({ updatedWithin: e.target.value ? Number(e.target.value) : null })}>
            {UPDATED_STEPS.map((d) => <option key={d ?? "any"} value={d ?? ""}>{d ? `${d} day${d > 1 ? "s" : ""}` : "Any time"}</option>)}
          </select>
        </label>
        <button className="btn w-full" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>
      </div>
    </Sheet>
  );
}

type Sort = "stars" | "pushed" | "name";

export function ListView({ regions, visibleIds, onSelect, selectedId }: { regions: GalaxyRegion[]; visibleIds: Set<number>; onSelect: (r: Repository) => void; selectedId: number | null }) {
  const [sort, setSort] = useState<Sort>("stars");
  const by = (a: Repository, b: Repository) => (sort === "stars" ? b.stars - a.stars : sort === "pushed" ? Date.parse(b.pushedAt) - Date.parse(a.pushedAt) : a.fullName.localeCompare(b.fullName));
  const count = regions.reduce((n, r) => n + r.repos.filter((x) => visibleIds.has(x.id)).length, 0);
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-4 pb-28">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{count} repositories</p>
        <label className="flex items-center gap-2 text-sm text-muted">
          Sort by
          <select className="field !w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="stars">Stars</option>
            <option value="pushed">Recent push</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>
      {count === 0 && <p className="glass rounded-xl p-6 text-center text-muted">No repositories match these filters. Try clearing one.</p>}
      {regions.map((region) => {
        const repos = region.repos.filter((r) => visibleIds.has(r.id)).sort(by);
        if (!repos.length) return null;
        return (
          <section key={region.slug} className="mb-8" aria-labelledby={`region-${region.slug}`}>
            <h2 id={`region-${region.slug}`} className="font-display text-lg font-semibold">{region.title}</h2>
            <p className="mb-3 text-xs text-faint">{region.definition}</p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {repos.map((r) => (
                <li key={r.id} className="min-w-0">
                  <button
                    onClick={() => onSelect(r)}
                    aria-current={r.id === selectedId}
                    className={`glass flex h-full w-full flex-col gap-1 rounded-xl p-3 text-left transition-colors hover:border-line-strong ${r.id === selectedId ? "!border-accent" : ""}`}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: languageColor(r.language) }} />
                      <span className="truncate font-medium">{r.fullName}</span>
                      <span className="ml-auto shrink-0 font-mono text-xs text-muted">★ {compact(r.stars)}</span>
                    </span>
                    {r.description && <span className="line-clamp-2 text-sm text-muted">{r.description}</span>}
                    <span className="mt-auto pt-1 text-xs text-faint">
                      {r.language ?? "No language"} · pushed <Ago iso={r.pushedAt} />
                      {r.starGrowth && r.starGrowth.gained > 0 && <span className="text-positive"> · +{compact(r.starGrowth.gained)} since {r.starGrowth.since}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function FavoritesPanel({ onOpen, onClose, inGalaxy }: { onOpen: (fullName: string) => void; onClose: () => void; inGalaxy: (fullName: string) => boolean }) {
  const favs = useFavorites();
  const file = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(favs, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-universe.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Sheet title="My Universe" onClose={onClose}>
      <p className="mb-3 text-xs text-faint">Saved only in this browser (localStorage). Nothing is sent to a server. Clearing site data removes it.</p>
      {favs.repos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">No saved planets yet. Open a planet and choose “Save planet”.</p>
      ) : (
        <ul className="space-y-1.5">
          {favs.repos.map((r) => (
            <li key={r.fullName} className="flex items-center gap-2 rounded-lg border border-line p-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: languageColor(r.language) }} />
              {inGalaxy(r.fullName) ? (
                <button className="min-w-0 flex-1 truncate text-left text-sm hover:text-accent" onClick={() => onOpen(r.fullName)}>{r.fullName}</button>
              ) : (
                <Link className="min-w-0 flex-1 truncate text-sm hover:text-accent" href={`/repo/${r.fullName}`}>{r.fullName}</Link>
              )}
              <span className="font-mono text-xs text-faint">★ {compact(r.stars)}</span>
              <button className="btn btn-icon !min-h-8 !w-8" aria-label={`Remove ${r.fullName}`} onClick={() => favorites.remove(r.fullName)}>
                <Icon name="x" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn" onClick={exportJson} disabled={!favs.repos.length}><Icon name="download" /> Export</button>
        <button className="btn" onClick={() => file.current?.click()}><Icon name="upload" /> Import</button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.size > 1_000_000) return setNote("That file is too large to be a saved collection.");
            const added = favorites.import(await f.text());
            setNote(added == null ? "That file isn't a valid Open Source Galaxy collection." : `Imported ${added} new planet${added === 1 ? "" : "s"}.`);
          }}
        />
        {favs.repos.length > 0 && (
          <button className="btn col-span-2 !text-danger" onClick={() => confirm("Remove all saved planets from this browser?") && favorites.clear()}>Clear all</button>
        )}
      </div>
      {note && <p role="status" className="mt-3 text-sm text-muted">{note}</p>}
    </Sheet>
  );
}

const SOURCE_TEXT: Record<DataSource, string> = {
  live: "Fetched from GitHub just now",
  cache: "From our cache of GitHub data",
  seed: "From a saved snapshot (GitHub was unreachable)",
};

export function HelpPanel({ onClose, regions, regionNoun, note, source, fetchedAt, languages, env }: {
  onClose: () => void; regions: GalaxyRegion[]; regionNoun: string; note: string; source: DataSource; fetchedAt: string; languages: string[]; env: { reducedMotion: boolean; lowEffects: boolean };
}) {
  const s = useSettings();
  const toggle = (label: string, on: boolean, set: (v: boolean) => void, hint: string) => (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="text-sm">{label}</span>
        <span className="block text-xs text-faint">{hint}</span>
      </span>
      <input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={on} onChange={(e) => set(e.target.checked)} />
    </label>
  );
  return (
    <Sheet title="What am I seeing?" onClose={onClose}>
      <div className="space-y-5 text-sm">
        <ul className="space-y-3">
          <li className="flex gap-3">
            <span aria-hidden className="flex w-10 shrink-0 items-end justify-center gap-1">
              <span className="rounded-full bg-muted" style={{ width: MIN_RADIUS * 6, height: MIN_RADIUS * 6 }} />
              <span className="rounded-full bg-muted" style={{ width: MAX_RADIUS * 6, height: MAX_RADIUS * 6 }} />
            </span>
            <span><strong>Planet</strong> = one repository. Size grows with stars on a log scale, so giants don&apos;t swallow the map. Surface style (terran, ocean, volcanic, gas and ice giants, desert, jungle, frozen, crystalline, metallic and more, some ringed) is decorative.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="flex w-10 shrink-0 flex-wrap content-start gap-1">
              {languages.slice(0, 6).map((l) => <span key={l} className="size-2.5 rounded-full" style={{ background: languageColor(l) }} />)}
            </span>
            <span><strong>Color</strong> = primary language on GitHub ({languages.slice(0, 4).join(", ")}…). Language says nothing about quality.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2.5 h-px w-10 shrink-0 bg-[#cfd6ff]/60" />
            <span><strong>Lines</strong> = repositories that declare the same GitHub topics. Similarity, <em>not</em> dependencies.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="w-10 shrink-0 text-center text-accent"><Icon name="nav" className="mx-auto size-4" /></span>
            <span><strong>Ship</strong> = you. It flies to whatever you select, or fly it yourself in flight mode.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-0.5 flex w-10 shrink-0 justify-center"><span className="size-4 animate-ping rounded-full border border-accent" /></span>
            <span><strong>Pulse</strong> = code pushed in the last 24 hours.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="w-10 shrink-0 text-center">🛰️</span>
            <span><strong>Satellites</strong> around a selected planet = releases published in the last 12 months (up to 8).</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="w-10 shrink-0 text-center">✨</span>
            <span><strong>Lights</strong> on a selected planet = its contributors (log scale), its &ldquo;population&rdquo;.</span>
          </li>
        </ul>

        <section>
          <h3 className="label mb-2">{regionNoun === "Category" ? "Categories" : "Regions"}</h3>
          <dl className="space-y-2">
            {regions.map((r) => (
              <div key={r.slug}>
                <dt className="font-medium">{r.title}</dt>
                <dd className="text-xs text-muted">{r.definition}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-faint">{note}</p>
        </section>

        <section>
          <h3 className="label mb-1">Controls</h3>
          <ul className="space-y-1 text-muted">
            <li>Drag to orbit · scroll or pinch to zoom</li>
            <li>Click a planet to inspect · double-click to travel</li>
            <li><kbd className="font-mono">/</kbd> search · <kbd className="font-mono">Esc</kbd> close / go back · <kbd className="font-mono">L</kbd> list view</li>
            <li>Flight mode (ship button, desktop): <kbd className="font-mono">W</kbd><kbd className="font-mono">A</kbd><kbd className="font-mono">S</kbd><kbd className="font-mono">D</kbd> to fly, <kbd className="font-mono">Enter</kbd> to inspect a nearby planet</li>
          </ul>
        </section>

        <section className="divide-y divide-line">
          <h3 className="label mb-1">Settings</h3>
          {toggle("Reduce motion", env.reducedMotion, (v) => settings.set({ reducedMotion: v }), s.reducedMotion == null ? "Following your system setting" : "Instant camera moves, no ambient animation")}
          {toggle("Low effects", env.lowEffects, (v) => settings.set({ lowEffects: v }), s.lowEffects == null ? "Chosen automatically for this device" : "Fewer particles, simpler planets")}
          {toggle("Show connections", s.connections, (v) => settings.set({ connections: v }), "Topic links in the overview")}
        </section>

        <section className="rounded-xl border border-line p-3 text-xs text-muted">
          <p>{SOURCE_TEXT[source]} · <Ago iso={fetchedAt} />.</p>
          <p className="mt-1">Data: public GitHub repository metadata. GitHub is the source of truth. <Link className="underline" href="/about">About &amp; privacy</Link></p>
        </section>
      </div>
    </Sheet>
  );
}

export function Hints({ onDone, touch }: { onDone: () => void; touch: boolean }) {
  const steps = touch
    ? [["Move", "Drag to orbit, pinch to zoom."], ["Select", "Tap any planet."], ["Inspect", "Read why it's interesting, save it, or open it on GitHub."]]
    : [["Move", "Drag to orbit, scroll to zoom."], ["Select", "Click a planet. Double-click to travel there."], ["Inspect", "Read why it's interesting, save it, or open it on GitHub."]];
  return (
    <div className="glass pointer-events-auto mx-auto w-full max-w-md rounded-2xl p-4 shadow-2xl" role="note">
      <ol className="grid grid-cols-3 gap-3">
        {steps.map(([t, d], i) => (
          <li key={t}>
            <span className="font-mono text-xs text-accent">0{i + 1}</span>
            <p className="font-display text-sm font-semibold">{t}</p>
            <p className="text-xs text-muted">{d}</p>
          </li>
        ))}
      </ol>
      <button className="btn mt-3 w-full" onClick={onDone}>Got it</button>
    </div>
  );
}
