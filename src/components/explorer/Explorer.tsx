"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { useEnvironment, useFavorites, useSettings } from "@/hooks/useStores";
import { facet, filtersFromParams, filtersToParams, matches, type Filters } from "@/lib/discovery/filters";
import { related } from "@/lib/discovery/related";
import { Ago } from "@/components/ui/Ago";
import { GALAXIES, getGalaxy } from "@/lib/galaxy/galaxies";
import { clusterCentres, layoutGalaxy, layoutKind, regionAnchors } from "@/lib/galaxy/layout";
import { settings } from "@/lib/storage/settings";
import type { RepoResult } from "@/lib/data/repo";
import type { GalaxyData, Repository } from "@/types";
import type { SceneApi } from "@/components/scene/GalaxyScene";
import { FavoritesPanel, FilterPanel, HelpPanel, Hints, ListView } from "./Panels";
import { RepoDetails, useRepoDetail } from "./RepoDetails";
import { SearchBox, type SearchPick } from "./SearchBox";
import { CompareTray } from "./Compare";
import { JourneyHud } from "./JourneyHud";
import { LogPanel } from "./LogPanel";
import { MissionChip } from "./MissionChip";
import { ScoreBadge } from "./ScoreBadge";
import { Hangar } from "./Hangar";
import { PlanetScanPanel } from "./PlanetScan";
import { warpTo } from "@/components/WarpOverlay";
import { usePlanetScan } from "@/hooks/usePlanetScan";
import { getJourney } from "@/lib/discovery/journeys";
import { compare, useCompare } from "@/lib/storage/compare";
import { explorerLog } from "@/lib/storage/log";

const GalaxyScene = dynamic(() => import("@/components/scene/GalaxyScene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center" role="status">
      <p className="animate-pulse text-sm text-muted">Charting the galaxy…</p>
    </div>
  ),
});

let webglSupport: boolean | undefined;
function hasWebGL() {
  if (webglSupport === undefined) {
    try {
      const c = document.createElement("canvas");
      webglSupport = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}
const noop = () => () => {};
const subscribeOnline = (l: () => void) => (addEventListener("online", l), addEventListener("offline", l), () => (removeEventListener("online", l), removeEventListener("offline", l)));

type Panel = "filters" | "favorites" | "help" | "log" | "hangar" | null;

export function Explorer({ data }: { data: GalaxyData }) {
  const galaxy = getGalaxy(data.slug)!;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const env = useEnvironment();
  const prefs = useSettings();
  const favs = useFavorites();
  const webgl = useSyncExternalStore(noop, hasWebGL, () => true);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [contextLost, setContextLost] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const sceneApi = useRef<SceneApi>(null);
  const onContextLost = useCallback(() => setContextLost(true), []);
  const [flightOn, setFlight] = useState(false);
  const [near, setNear] = useState<number | null>(null);
  const speedRef = useRef<HTMLSpanElement>(null);
  const onSpeed = useCallback((v: number) => {
    if (speedRef.current) speedRef.current.textContent = String(Math.round(v));
  }, []);
  const pushedSelection = useRef(false);

  const filters = useMemo(() => filtersFromParams(params), [params]);
  const repoParam = params.get("repo")?.toLowerCase() ?? null;
  const can3D = webgl && !contextLost;
  const view = params.get("view") === "list" || !can3D ? "list" : "space";
  // Flight needs a keyboard; touch-first devices keep tap-to-travel.
  const flight = flightOn && view === "space" && !env.touch;

  const kind = layoutKind(galaxy.theme.shape);
  const planets = useMemo(() => layoutGalaxy(data, kind), [data, kind]);
  const clusters = useMemo(() => (kind !== "spiral" ? clusterCentres(data, kind) : undefined), [data, kind]);
  const allRepos = useMemo(() => planets.map((p) => p.repo), [planets]);
  const indexByName = useMemo(() => new Map(planets.map((p, i) => [p.repo.fullName.toLowerCase(), i])), [planets]);
  const visible = useMemo(() => planets.map((p) => matches(p.repo, p.region, filters)), [planets, filters]);
  const visibleIds = useMemo(() => new Set(planets.filter((_, i) => visible[i]).map((p) => p.repo.id)), [planets, visible]);
  const selected = repoParam != null ? (indexByName.get(repoParam) ?? null) : null;

  // Guided journey (?journey=slug&stop=n): the current stop is the scene's focus even without a detail panel open.
  const journey = useMemo(() => {
    const j = getJourney(params.get("journey") ?? "");
    return j && j.stops.some((s) => indexByName.has(s.fullName.toLowerCase())) ? j : null;
  }, [params, indexByName]);
  const stopIndex = journey ? Math.min(Math.max(0, Number(params.get("stop")) || 0), journey.stops.length) : 0;
  const stopPlanet = journey && stopIndex < journey.stops.length ? (indexByName.get(journey.stops[stopIndex].fullName.toLowerCase()) ?? null) : null;
  const focus = selected ?? stopPlanet;
  const route = useMemo(() => {
    if (!journey) return null;
    const indices = journey.stops.flatMap((s) => indexByName.get(s.fullName.toLowerCase()) ?? []);
    return { indices, active: stopPlanet != null ? indices.indexOf(stopPlanet) : null };
  }, [journey, indexByName, stopPlanet]);

  const [travel, setTravel] = useState<{ index: number } | null>(() => (focus != null ? { index: focus } : null));
  const focusRepo = focus != null ? planets[focus].repo : null;
  const { scan, state: scanState } = usePlanetScan(view === "space" ? (focusRepo?.fullName ?? null) : null);
  const compared = useCompare();

  // Every planet you open or reach on a journey goes into the local Explorer's Log.
  useEffect(() => {
    if (focus != null) explorerLog.visit(planets[focus].repo, galaxy.slug, planets[focus].region);
  }, [focus, planets, galaxy.slug]);
  const regionLabels = useMemo(() => {
    const anchors = regionAnchors(data, kind);
    return data.regions.map((r) => ({ title: r.title, position: anchors[r.slug] }));
  }, [data, kind]);
  const languages = useMemo(() => facet(allRepos, (r) => r.language, 8).map((f) => f.value), [allRepos]);

  const setUrl = useCallback(
    (mutate: (p: URLSearchParams) => void, push = false) => {
      const p = new URLSearchParams(window.location.search);
      mutate(p);
      const url = `${pathname}${p.size ? `?${p}` : ""}`;
      // Native history keeps camera and scene alive; Next syncs useSearchParams with it.
      if (push) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [pathname],
  );

  const selectIndex = useCallback(
    (i: number | null, doTravel: boolean) => {
      if (i == null) {
        // Opening pushed a history entry; closing pops it so Back stays meaningful.
        if (pushedSelection.current) window.history.back();
        else setUrl((p) => p.delete("repo"));
        pushedSelection.current = false;
        return;
      }
      const opening = !params.get("repo");
      setUrl((p) => p.set("repo", planets[i].repo.fullName), opening);
      if (opening) pushedSelection.current = true;
      if (doTravel) setTravel({ index: i });
    },
    [params, planets, setUrl],
  );

  const selectRepo = useCallback(
    (r: Repository, doTravel = true) => {
      const i = indexByName.get(r.fullName.toLowerCase());
      if (i != null) selectIndex(i, doTravel);
    },
    [indexByName, selectIndex],
  );

  const goStop = useCallback(
    (i: number) => {
      if (!journey) return;
      setUrl((p) => {
        p.set("stop", String(i));
        p.delete("repo");
      });
      pushedSelection.current = false;
      const target = i < journey.stops.length ? indexByName.get(journey.stops[i].fullName.toLowerCase()) : undefined;
      if (target != null) setTravel({ index: target });
      if (i >= journey.stops.length) explorerLog.completeJourney(journey.slug);
    },
    [journey, indexByName, setUrl],
  );
  const exitJourney = () => setUrl((p) => (p.delete("journey"), p.delete("stop")));

  const switchGalaxy = async (slug: string) => {
    const g = getGalaxy(slug);
    if (!g) return;
    await warpTo(g.theme.accent);
    router.push(`/galaxy/${slug}`);
  };

  const setFilters = (f: Filters) => setUrl((p) => void filtersToParams(f, p));
  const setView = (v: "space" | "list") => setUrl((p) => (v === "list" ? p.set("view", "list") : p.delete("view")));

  // Back button fired while a planet was open: our pushed entry is gone.
  useEffect(() => {
    const onPop = () => (pushedSelection.current = false);
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
      if (e.key === "Escape") {
        if (panel) setPanel(null);
        else if (flight) setFlight(false);
        else if (repoParam) selectIndex(null, false);
        else if (journey) exitJourney();
      } else if (!typing && journey && !flight && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        const next = stopIndex + (e.key === "ArrowRight" ? 1 : -1);
        if (next >= 0 && next <= journey.stops.length) goStop(next);
      } else if (!typing && (e.key === "l" || e.key === "L") && can3D && !e.metaKey && !e.ctrlKey) {
        setView(view === "list" ? "space" : "list");
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  const onPick = ({ repo, inGalaxy }: SearchPick) => {
    if (inGalaxy) {
      // Make sure the planet isn't hidden by a filter the visitor forgot about.
      const i = indexByName.get(repo.fullName.toLowerCase())!;
      if (!visible[i]) setUrl((p) => void filtersToParams({ language: null, topic: null, license: null, minStars: 0, updatedWithin: null, region: null }, p));
      selectRepo(repo, true);
    } else router.push(`/repo/${repo.fullName}`);
  };

  const shown = visibleIds.size;
  const activeFilters = Object.values(filters).filter((v) => v).length;
  const selectedPlanet = selected != null ? planets[selected] : null;
  const regionNote = selectedPlanet ? data.regions.find((r) => r.slug === selectedPlanet.region) : undefined;

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg" style={{ "--accent": galaxy.theme.accent } as React.CSSProperties}>
      {view === "space" ? (
        <GalaxyScene
          planets={planets}
          visible={visible}
          selected={focus}
          travel={travel}
          scan={scan}
          scanning={scanState === "scanning"}
          route={route}
          onTravelled={explorerLog.addDistance}
          theme={galaxy.theme}
          seed={galaxy.slug}
          regionLabels={regionLabels}
          clusters={clusters}
          reducedMotion={env.reducedMotion}
          lowEffects={env.lowEffects}
          connections={env.connections}
          onSelect={selectIndex}
          onContextLost={onContextLost}
          apiRef={sceneApi}
          flight={flight}
          onNear={setNear}
          onSpeed={onSpeed}
        />
      ) : (
        <div className="scroll-thin absolute inset-0 overflow-y-auto pt-40 md:pt-24">
          {!can3D && (
            <p className="mx-auto mb-2 max-w-4xl px-4 text-sm text-caution">
              {contextLost ? "The 3D view stopped (graphics context lost)." : "This device can’t show the 3D view."} Here’s the same galaxy as a list.
            </p>
          )}
          <ListView regions={data.regions} visibleIds={visibleIds} onSelect={(r) => selectRepo(r, false)} selectedId={selectedPlanet?.repo.id ?? null} />
        </div>
      )}

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 p-3">
        <div className="glass pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl p-2 md:flex-nowrap">
          <Link href="/" className="flex items-center gap-2 rounded-lg px-2 py-1 font-display text-sm font-semibold" aria-label="Open Source Galaxy home">
            <Icon name="orbit" className="size-5 text-accent" />
            <span className="hidden lg:inline">Open Source Galaxy</span>
          </Link>
          <label className="sr-only" htmlFor="galaxy-select">Galaxy</label>
          <select id="galaxy-select" className="field min-w-0 flex-1 md:!w-auto md:max-w-[11rem] md:flex-none" value={galaxy.slug} onChange={(e) => void switchGalaxy(e.target.value)}>
            {GALAXIES.map((g) => (
              <option key={g.slug} value={g.slug} disabled={!g.available}>{g.title}{g.available ? "" : " (charting soon)"}</option>
            ))}
          </select>
          <div className="order-last w-full md:order-none md:mx-auto md:max-w-md">
            <SearchBox repos={allRepos} onPick={onPick} initialQuery={params.get("q") ?? ""} />
          </div>
          <nav className="flex shrink-0 items-center gap-1.5" aria-label="Explorer tools">
            <ScoreBadge onOpen={() => setPanel(panel === "log" ? null : "log")} />
            <button className="btn relative" aria-pressed={panel === "filters"} onClick={() => setPanel(panel === "filters" ? null : "filters")} aria-label={`Filters${activeFilters ? `, ${activeFilters} active` : ""}`}>
              <Icon name="sliders" /> <span className="hidden sm:inline">Filters</span>
              {activeFilters > 0 && <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-accent text-[0.65rem] font-bold text-black">{activeFilters}</span>}
            </button>
            <button className="btn relative" aria-pressed={panel === "favorites"} onClick={() => setPanel(panel === "favorites" ? null : "favorites")} aria-label={`My Universe, ${favs.repos.length} saved`}>
              <Icon name="heart" /> <span className="hidden sm:inline">Saved</span>
              {favs.repos.length > 0 && <span className="font-mono text-xs text-muted">{favs.repos.length}</span>}
            </button>
            <button className="btn btn-icon" aria-pressed={panel === "log"} onClick={() => setPanel(panel === "log" ? null : "log")} aria-label="Explorer's Log: visits, achievements and missions" title="Explorer's Log">
              <Icon name="book" />
            </button>
            <button className="btn btn-icon" aria-pressed={panel === "help"} onClick={() => setPanel(panel === "help" ? null : "help")} aria-label="What am I seeing? Legend, controls and settings">
              <Icon name="help" />
            </button>
          </nav>
        </div>
      </header>

      {/* Breadcrumb + status */}
      <div className="pointer-events-none absolute top-[8.5rem] left-3 z-20 max-w-[calc(100%-1.5rem)] space-y-2 md:top-20">
        <nav aria-label="Breadcrumb" className="pointer-events-auto text-xs text-muted">
          <Link href="/" className="hover:text-text">Universe</Link> <span aria-hidden>/</span> <span className="text-text">{galaxy.title}</span>
          <span className="text-faint"> · {shown} of {planets.length} planets</span>
        </nav>
        {!journey && !flight && !panel && (
          <div className="pointer-events-auto">
            <MissionChip galaxy={galaxy.slug} repos={allRepos} regions={data.regions} />
          </div>
        )}
        {data.source === "seed" && (
          <p role="status" className="glass pointer-events-auto rounded-lg px-3 py-2 text-xs text-caution">GitHub is unreachable, so you&apos;re seeing a saved snapshot from <Ago iso={data.fetchedAt} />.</p>
        )}
        {!online && <p role="status" className="glass pointer-events-auto rounded-lg px-3 py-2 text-xs text-caution">You&apos;re offline. Everything already loaded still works.</p>}
      </div>

      {/* Left panels */}
      {panel && panel !== "hangar" && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-40 flex max-h-[70vh] md:top-28 md:right-auto md:bottom-auto md:left-3 md:max-h-[calc(100%-8rem)] md:w-80">
          <div className="flex w-full">
            {panel === "filters" && <FilterPanel filters={filters} setFilters={setFilters} repos={allRepos} regions={data.regions} regionNoun={galaxy.regionNoun} shown={shown} total={planets.length} onClose={() => setPanel(null)} />}
            {panel === "favorites" && (
              <FavoritesPanel
                onClose={() => setPanel(null)}
                inGalaxy={(n) => indexByName.has(n.toLowerCase())}
                onOpen={(n) => {
                  setPanel(null);
                  selectIndex(indexByName.get(n.toLowerCase())!, true);
                }}
              />
            )}
            {panel === "log" && <LogPanel onClose={() => setPanel(null)} />}
            {panel === "help" && <HelpPanel onClose={() => setPanel(null)} regions={data.regions} regionNoun={galaxy.regionNoun} note={galaxy.note} source={data.source} fetchedAt={data.fetchedAt} languages={languages} env={env} />}
          </div>
        </div>
      )}

      {/* Detail panel: right column on desktop, bottom sheet on mobile */}
      {selectedPlanet ? (
        <DetailPanel
          key={selectedPlanet.repo.id}
          repo={selectedPlanet.repo}
          regionNote={regionNote ? `${regionNote.title}: ${regionNote.definition}` : undefined}
          hidden={!visible[selected!]}
          pool={allRepos.filter((r) => visibleIds.has(r.id))}
          onClose={() => selectIndex(null, false)}
          onTravel={view === "space" ? () => setTravel({ index: selected! }) : undefined}
          onPick={(r) => selectRepo(r, view === "space")}
        />
      ) : (
        repoParam && <ExternalRepoPanel fullName={repoParam} onClose={() => selectIndex(null, false)} />
      )}

      {/* Scene controls */}
      <div className="absolute right-3 bottom-3 z-20 flex flex-col gap-1.5 md:right-auto md:left-3" role="toolbar" aria-label="View controls">
        {can3D && (
          <button className="btn btn-icon glass" onClick={() => setView(view === "list" ? "space" : "list")} aria-label={view === "list" ? "Show 3D view" : "Show list view"} title="Toggle list view (L)">
            <Icon name={view === "list" ? "orbit" : "list"} />
          </button>
        )}
        {view === "space" && (
          <button className="btn btn-icon glass" aria-pressed={panel === "hangar"} onClick={() => setPanel(panel === "hangar" ? null : "hangar")} aria-label="Hangar: choose your ship" title="Hangar">
            <span aria-hidden className="text-base leading-none">🚀</span>
          </button>
        )}
        {view === "space" && !env.touch && (
          <button className={`btn btn-icon glass ${flight ? "!border-accent !text-accent" : ""}`} aria-pressed={flight} onClick={() => setFlight(!flight)} aria-label={flight ? "Exit flight mode" : "Flight mode (fly the ship with W A S D)"} title="Flight mode">
            <Icon name="nav" />
          </button>
        )}
        {view === "space" && !flight && (
          <>
            <button className="btn btn-icon glass" onClick={() => sceneApi.current?.zoom(-1)} aria-label="Zoom in"><Icon name="plus" /></button>
            <button className="btn btn-icon glass" onClick={() => sceneApi.current?.zoom(1)} aria-label="Zoom out"><Icon name="minus" /></button>
            <button className="btn btn-icon glass" onClick={() => (repoParam ? selectIndex(null, false) : sceneApi.current?.reset())} aria-label="Reset view"><Icon name="home" /></button>
          </>
        )}
      </div>

      {flight && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex justify-center">
          <div className="glass pointer-events-auto flex max-w-2xl flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-2.5 text-xs text-muted" role="status">
            <span className="font-display text-sm font-semibold text-accent">Flight mode</span>
            <span className="font-mono text-text"><span ref={speedRef}>0</span> u/s</span>
            <span><kbd className="font-mono text-text">W</kbd>/<kbd className="font-mono text-text">S</kbd> throttle · <kbd className="font-mono text-text">A</kbd>/<kbd className="font-mono text-text">D</kbd> turn · <kbd className="font-mono text-text">↑</kbd>/<kbd className="font-mono text-text">↓</kbd> pitch · drag to look · <kbd className="font-mono text-text">Shift</kbd> boost · <kbd className="font-mono text-text">Space</kbd> brake</span>
            {near != null && planets[near] ? (
              <span className="text-text">Near <strong>{planets[near].repo.fullName}</strong> · <kbd className="font-mono text-accent">Enter</kbd> to inspect</span>
            ) : null}
            <button className="btn !min-h-8 !px-3 text-xs" onClick={() => setFlight(false)}>Exit (Esc)</button>
          </div>
        </div>
      )}

      {panel === "hangar" && <Hangar onClose={() => setPanel(null)} />}

      {journey && !flight && (
        <div className={`pointer-events-none absolute inset-x-3 z-20 flex justify-center ${selectedPlanet ? "bottom-3 md:right-[424px]" : "bottom-3"} max-md:right-16 max-md:bottom-3`}>
          <div className="pointer-events-auto w-full max-w-lg">
            <JourneyHud journey={journey} stopIndex={stopIndex} available={(n) => indexByName.has(n.toLowerCase())} onGo={goStop} onExit={exitJourney} />
          </div>
        </div>
      )}
      {!journey && !flight && compared.length > 0 && !(env.mobile && selectedPlanet) && <CompareTray />}

      {view === "space" && !flight && !journey && !prefs.hintsDismissed && !repoParam && !panel && (
        <div className="pointer-events-none absolute inset-x-3 top-[10.5rem] z-20 md:top-auto md:bottom-6">
          <Hints touch={env.touch} onDone={() => settings.set({ hintsDismissed: true })} />
        </div>
      )}
    </div>
  );
}

function PanelShell({ onClose, label, children }: { onClose: () => void; label: string; children: React.ReactNode }) {
  return (
    <aside
      aria-label={label}
      className="scroll-thin absolute inset-x-0 bottom-0 z-30 max-h-[68vh] border border-line bg-panel-solid overflow-y-auto overscroll-contain rounded-t-2xl p-5 pt-3 shadow-2xl md:inset-x-auto md:top-20 md:right-3 md:bottom-3 md:max-h-none md:w-[400px] md:rounded-2xl md:pt-5"
    >
      <div className="pointer-events-none sticky top-0 z-10 -mx-5 -mt-3 mb-2 flex justify-between px-5 pt-3 md:-mt-5 md:pt-5">
        <span aria-hidden className="mx-auto mt-1 h-1 w-10 rounded-full bg-line-strong md:hidden" />
        <button className="btn btn-icon pointer-events-auto absolute top-2 right-3 !min-h-9 !w-9 !bg-panel-solid shadow-lg" onClick={onClose} aria-label="Close details (Esc)">
          <Icon name="x" />
        </button>
      </div>
      {children}
    </aside>
  );
}

function DetailPanel({ repo: base, regionNote, hidden, pool, onClose, onTravel, onPick }: {
  repo: Repository; regionNote?: string; hidden: boolean; pool: Repository[]; onClose: () => void; onTravel?: () => void; onPick: (r: Repository) => void;
}) {
  const { repo, releaseChecked } = useRepoDetail(base, true);
  const comparing = useCompare().some((r) => r.fullName === repo.fullName);
  const near = useMemo(() => related(base, pool, 5), [base, pool]);
  const heading = useRef<HTMLDivElement>(null);
  // Move keyboard focus into the panel so screen-reader and keyboard users land on the details.
  useEffect(() => heading.current?.focus(), [base.id]);
  return (
    <PanelShell onClose={onClose} label={`${repo.fullName} details`}>
      <div ref={heading} tabIndex={-1} className="outline-none">
        {hidden && <p className="mb-3 rounded-lg border border-caution/40 px-3 py-2 text-xs text-caution">Hidden by your current filters.</p>}
        <RepoDetails
          repo={repo}
          releaseChecked={releaseChecked}
          regionNote={regionNote}
          actions={
            <>
              {onTravel && (
                <button className="btn" onClick={onTravel}>
                  <Icon name="nav" /> Travel
                </button>
              )}
              <button className={`btn ${onTravel ? "" : "col-span-2"}`} aria-pressed={comparing} onClick={() => compare.toggle(repo)}>
                <Icon name="sliders" /> {comparing ? "Comparing" : "Compare"}
              </button>
            </>
          }
        />
        <div className="mt-6">
          <PlanetScanPanel fullName={repo.fullName} />
        </div>
        <section className="mt-5">
          <h3 className="label mb-1">Explore nearby</h3>
          <p className="mb-2 text-xs text-faint">Repositories here sharing GitHub topics with this one. Similar, not dependencies.</p>
          {near.length === 0 ? (
            <p className="text-sm text-muted">No visible planets share its topics.</p>
          ) : (
            <ul className="space-y-1">
              {near.map((n) => (
                <li key={n.repo.id}>
                  <button className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/5" onClick={() => onPick(n.repo)}>
                    <span className="block truncate text-sm">{n.repo.fullName}</span>
                    <span className="block truncate text-xs text-faint">shares: {n.shared.join(", ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PanelShell>
  );
}

/** A ?repo= link to something outside this galaxy: fetch it so the link still works. */
function ExternalRepoPanel({ fullName, onClose }: { fullName: string; onClose: () => void }) {
  const [result, setResult] = useState<{ for: string; r: RepoResult | null } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/repo/${fullName}`)
      .then((r) => r.json() as Promise<RepoResult>)
      .catch(() => null)
      .then((r) => live && setResult({ for: fullName, r }));
    return () => void (live = false);
  }, [fullName]);
  const r = result?.for === fullName ? result.r : undefined;
  return (
    <PanelShell onClose={onClose} label="Repository details">
      {r === undefined && <p className="animate-pulse text-sm text-muted" role="status">Looking up {fullName}…</p>}
      {r?.status === "ok" && (
        <>
          <p className="mb-3 rounded-lg border border-line px-3 py-2 text-xs text-muted">Not a planet in this galaxy, but here are its details.</p>
          <RepoDetails repo={r.repo} releaseChecked />
        </>
      )}
      {r?.status === "not_found" && <p className="text-sm text-muted">No public repository called <strong>{fullName}</strong>. It may be private, renamed, or deleted.</p>}
      {(r === null || r?.status === "unavailable") && (
        <p className="text-sm text-caution">
          Couldn&apos;t reach GitHub{r?.status === "unavailable" && r.reason === "rate_limited" ? " (rate limit reached)" : ""}. Try again shortly, or{" "}
          <a className="underline" href={`https://github.com/${fullName}`} target="_blank" rel="noopener noreferrer">open it on GitHub</a>.
        </p>
      )}
    </PanelShell>
  );
}
