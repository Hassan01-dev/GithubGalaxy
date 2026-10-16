import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { HeroMap } from "@/components/HeroMap";
import { ProgressCard } from "@/components/ProgressCard";
import { GALAXIES } from "@/lib/galaxy/galaxies";

export default function Home() {
  return (
    <main>
      <section className="relative h-dvh min-h-[36rem] overflow-hidden">
        {/* Painted backdrop: first paint before WebGL, and the fallback without it. */}
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,#3a2160_0%,#120d2a_35%,#04050c_70%)]" />
        {/* On phones the map takes the top of the screen so it never sits behind the headline. */}
        <div className="absolute inset-x-0 top-0 h-[58%] md:h-full">
          <HeroMap />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />

        <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 sm:p-6">
          <span className="flex items-center gap-2 font-display font-semibold">
            <Icon name="orbit" className="size-5 text-accent" /> Open Source Galaxy
          </span>
          <nav className="flex gap-5 text-sm text-muted">
            <Link href="/journeys" className="hover:text-text">Journeys</Link>
            <Link href="/about" className="hover:text-text">About</Link>
          </nav>
        </header>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 pb-10 sm:p-10">
          <div className="pointer-events-auto max-w-xl">
            <h1 className="font-display text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl" aria-label="Explore the universe of open source.">
              {"Explore the universe of open source.".split(" ").map((w, i) => (
                <span key={i} aria-hidden className="reveal inline-block" style={{ "--i": i } as React.CSSProperties}>
                  {w}&nbsp;
                </span>
              ))}
            </h1>
            <p className="reveal mt-4 max-w-md text-muted sm:text-lg" style={{ "--i": 7 } as React.CSSProperties}>Fly through real GitHub repositories, find projects worth using, and share what you discover.</p>
            <form action="/galaxy/trending" className="mt-6 flex max-w-md gap-2" role="search">
              <label htmlFor="hero-q" className="sr-only">Search repositories</label>
              <input id="hero-q" name="q" className="field glass !min-h-12" placeholder="Search a library, topic, or need…" minLength={2} required />
              <button className="btn !min-h-12" aria-label="Search"><Icon name="search" /></button>
            </form>
            <Link href="/galaxy/trending" className="btn btn-primary mt-3 !min-h-12 !px-6 text-base">
              Enter the Galaxy <Icon name="nav" />
            </Link>
          </div>
        </div>
        {/* Phones get the welcome-back toast and the explorer's score badge instead; here it would cover the map. */}
        <div className="absolute top-20 right-6 z-10 hidden w-[22rem] sm:block">
          <ProgressCard />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="galaxies">
        <h2 id="galaxies" className="font-display text-2xl font-semibold">Galaxies</h2>
        <p className="mt-1 text-muted">Each one is a different way to discover. Open galaxies are ready to explore; the rest are being charted.</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GALAXIES.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/galaxy/${g.slug}`}
                className={`glass group flex h-full flex-col rounded-2xl p-5 transition-colors hover:border-line-strong ${g.available ? "" : "opacity-70"}`}
              >
                <span className="mb-4 h-1 w-10 rounded-full" style={{ background: g.theme.accent }} />
                <span className="font-display text-lg font-semibold">{g.title}</span>
                <span className="text-sm text-muted">{g.tagline}</span>
                <span className="mt-4 text-xs" style={{ color: g.available ? g.theme.accent : undefined }}>{g.available ? "Open now →" : "Charting soon"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="play">
        <h2 id="play" className="font-display text-2xl font-semibold">More than a map</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Guided journeys", "Hand-picked routes with a note at every stop. Fly them on autopilot.", "/journeys"],
            ["Planet scans", "Contributors as population, releases as satellites, a year of commit activity.", "/galaxy/trending"],
            ["Daily mission", "A small discovery challenge each day, checked only against real data.", "/galaxy/ai"],
            ["Flight mode", "Take the controls: W A S D to fly between planets (desktop).", "/galaxy/trending"],
          ].map(([t, d, href]) => (
            <li key={t}>
              <Link href={href} className="glass flex h-full flex-col rounded-2xl p-5 transition-colors hover:border-line-strong">
                <span className="font-display font-semibold">{t}</span>
                <span className="mt-1 text-sm text-muted">{d}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6" aria-labelledby="legend">
        <h2 id="legend" className="font-display text-2xl font-semibold">How to read the universe</h2>
        <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Planets", "Each planet is a real GitHub repository. Bigger means more stars, on a log scale."],
            ["Colors", "A planet's hue is its primary language. Language says nothing about quality."],
            ["Connections", "Lines join repositories that share GitHub topics. Similar, not dependent."],
            ["Regions", "Each region is a labelled GitHub search, with its exact definition and dates shown."],
          ].map(([t, d]) => (
            <div key={t}>
              <dt className="font-display font-semibold">{t}</dt>
              <dd className="mt-1 text-sm text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="border-t border-line px-4 py-6 text-center text-xs text-faint sm:px-6">
        Data comes from public GitHub repositories via the GitHub API. GitHub is the source of truth. Not affiliated with GitHub. ·{" "}
        <Link href="/about" className="underline">About &amp; privacy</Link>
      </footer>
    </main>
  );
}
