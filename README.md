# Open Source Galaxy

Explore open-source software as a universe. Each planet is a real public GitHub repository. Each region shows its exact definition and dates, so you can check why a repo is there.

**Status:** the universe map shows six galaxies. Three are fully built:

- **Trending**
- **AI & Machine Learning**
- **Community Constellations** (guided journeys)

Language Galaxies, Foundations and Hidden Gems are registered and show "charting soon".

## Features at a glance

- **Planet scan:** opening a planet fetches deeper real data.
  - Contributors become the planet's *population*: count, avatars, and city lights on its night side.
  - Releases from the last 12 months orbit as *satellites*.
  - You also get a 52-week *activity pulse* and a language *composition* bar.
- **Activity beacons:** planets pushed in the last 24 hours pulse.
- **Guided journeys** (`/journeys`):
  - Six editorial routes with a note at every stop. Fly them in the 3D galaxy with prev/next/skip, the ← → keys, and a share link.
  - Each journey also has a route page that works without WebGL.
- **Daily mission:** one small challenge per galaxy per day. It is only built from data the galaxy actually contains, and only checked against real fields.
- **Explorer's Log:**
  - Visited planets, galaxies, languages, distance flown and finished journeys.
  - 12 achievements, announced with animated toasts.
  - Stored only in the browser.
- **Planets:** 13 procedural surface styles, plus per-planet variation and seeded rings.
  - Styles: terran, ocean, volcanic, ice giant, gas giant, toxic, desert, frozen moon, crystalline, metallic, jungle, cloud-veiled, barren.
  - Variation: hue shift, bands, craters and ice caps.
  - The selected planet becomes a high-detail close-up with surface relief, drifting clouds, an atmosphere glow and detailed rings.
  - Style is decorative; colour still means language.
- **Hangar:** 6 ships (Scout, Interceptor, Manta, Hauler, Ring Runner, Solar Lantern).
  - Each ship is a procedural model with idle animation and a live 3D preview.
  - Ship stats really change flight handling, within capped speeds.
  - Your choice is saved in the browser.
- **Score and ranks:** XP is *derived* from your Explorer's Log, never stored separately.
  - Points: +10 per planet, +25 per language, +50 per galaxy, +100 per achievement, +75 per mission, +150 per journey, and +1 per 100 units flown (capped at 500).
  - Ranks: Cadet → Explorer → Navigator → Pathfinder → Voyager → Star Cartographer → Legend.
  - You see a score badge in the explorer, a "Welcome back" card on the landing page, and a toast when you return after 30+ minutes.
  - **Back up / restore** all progress (log, favorites, settings) as a JSON file from the Log panel. Imports are validated and merged.
- **Compare:** up to 3 planets side by side, using only real fields. Highlights include a note that stars aren't a quality metric.
- **Flight mode** with a radar minimap, a **warp** transition between galaxies, and anime.js micro-animations throughout.
  - Everything respects Reduce motion and Low effects.

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · Three.js + React Three Fiber + Drei · Tailwind CSS 4 · Prisma 7 + PostgreSQL (Supabase in production) · Zod · Vitest · Playwright

## Local setup

```bash
npm install                  # also runs `prisma generate`
neon env pull                # writes DATABASE_URL + DATABASE_URL_UNPOOLED for the linked Neon branch into .env
npm run db:deploy            # apply migrations (direct connection)
npm run dev                  # http://localhost:3000
```

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Runtime connection, **pooled** (Neon: the `-pooler` host). |
| `DATABASE_URL_UNPOOLED` | yes | Migrations only, **direct** (Neon: same host without `-pooler`). On other hosts you can name it `DIRECT_URL` instead. |
| `GITHUB_TOKEN` | strongly recommended | Server-only. Raises GitHub limits (search: 10 → 30 req/min; core: 60 → 5,000 req/h). Any classic or fine-grained token with no scopes works. **Never** prefix it with `NEXT_PUBLIC_`. |

**Why the token matters:**
- A planet scan costs about 5 core calls, and repo details cost 2. Without a token, roughly 10 new planets an hour exhaust the 60/h quota.
- Scans are cached in Postgres for 12 hours, so each repo is scanned at most twice a day.
- When the quota runs out, the app falls back to cached data and says "rate limit reached". Nothing breaks.

## Scripts

| | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint (incl. React Compiler rules) · TypeScript |
| `npm test` | Vitest unit tests (mapping, sizing, layout determinism, filters/URL state, signals, favorites, debounce) |
| `npm run test:e2e` | Playwright: builds, starts on :3200, runs desktop (software WebGL) + mobile journeys |
| `npm run db:migrate` · `db:deploy` | Prisma migrate (dev) · apply migrations (prod) |
| `npm run seed:snapshot` | Re-captures real GitHub data into `src/data/seed/*.json` (the offline fallback) |

## How data flows

```
visitor ─▶ Next cache ("use cache") ─▶ Postgres (fresh < 3h?) ─▶ GitHub search API
                                            │ stale/empty            │ fails
                                            ▼                        ▼
                                   last DB copy  ◀───────────  committed seed JSON
```

- **One GitHub refresh per galaxy per 3 hours**, no matter how many visitors arrive. Repo detail (with latest release) refreshes every 6 hours.
- Every fetch records a **daily star snapshot** per repo (`StarSnapshot`). Once two days of snapshots exist, planets show measured growth ("+120 stars since 2026-10-10"). Nothing is estimated.
- The loaders never throw. The UI labels the data `live`, `cache`, or `seed` and shows its age.
- Search goes `/api/search` → GitHub (cached per query; rate limits surface as a clear UI state). Matches inside the current galaxy are instant and work offline.

## Trending Galaxy: definitions

GitHub has no public trending API, so each region is a labelled search:

| Region | Query | Placement |
|---|---|---|
| Rising stars | created in the last 30 days, ≥20★, by stars (100) | spiral arms |
| Breakout year | created in the last 12 months, ≥1,000★, pushed in the last 7 days (60) | inner disc |
| Newly discovered | created in the last 180 days, 30–300★, pushed in the last 7 days (60) | outer frontier ring |

A repo appears in only the first region that claims it.

## AI & Machine Learning Galaxy: definitions

Six star systems on a ring, one per GitHub topic. Each region uses a single `topic:` query: GitHub search rejects `OR` between topic qualifiers.

| System | Topic | Rule |
|---|---|---|
| Agents | `ai-agents` | ≥200★, pushed in the last 90 days, by stars (40) |
| Retrieval & RAG | `rag` | same |
| LLM inference & serving | `llm-inference` | same |
| Evaluation & observability | `llm-evaluation` | same |
| Computer vision | `computer-vision` | same |
| ML foundations | `machine-learning` | same |

Topics are chosen by maintainers, so some placements look odd. That's shown as-is, never "corrected" by guessing from names. A repo joins the first system whose topic it declares.

## Flight mode (desktop)

Press the ship button (bottom-left) to fly the ship yourself:

| Key | Action |
|---|---|
| `W` / `S` | throttle / reverse |
| `A` / `D` or `←` / `→` | turn |
| `↑` / `↓` or `R` / `F` | pitch |
| drag | look around |
| `Shift` | boost (capped) |
| `Space` | brake |
| `Enter` | inspect the nearby planet shown in the HUD |
| `Esc` | back to orbit |

- No roll or shake, and speed is capped.
- The chase camera eases into position. Glows fade as you get close so the core never whites out the screen.
- Flight mode is hidden on touch devices; tap-to-travel covers those.

## Visual encoding

- **Planet size:** log-scaled stars, bounded 0.4–2.0 units, so one giant can't hide the map.
- **Planet hue:** primary language (GitHub linguist colours).
- **Surface style:** decorative only, derived from the repo name.
- **Lines:** shared GitHub topics. They mean "similar", not "depends on".
- **Placement:** seeded from the repo name, then a small order-independent relaxation pass so planets don't overlap. Reloads give the same layout. Spiral galaxies place regions as disc bands; the other shapes place each region as its own star system (`layoutKind` in `layout.ts`).

## Rendering notes

- All planets are one instanced mesh with a procedural shader (1 draw call), plus an invisible, larger instanced hit-mesh for forgiving clicks and taps.
- Dust and stars are single `Points` draws with capped point size.
- Labels are plain DOM nodes positioned each frame through refs. Drei `<Html>` is avoided: its per-label React roots race with React 19 unmounts.
- Motion and effects:
  - **Reduced motion** (OS setting or toggle): instant camera moves, on-demand rendering.
  - **Low effects** (automatic on touch/small screens, or toggled): fewer particles, simpler geometry, lower DPR.
- If WebGL is missing or the context is lost, the explorer switches to the list view, which is a full alternative: keyboard-navigable, filterable, and sortable.

## Routes

`/` landing + universe map · `/explore` → default galaxy · `/galaxy/[slug]` explorer (URL state: `repo`, `view=list`, `lang`, `topic`, `license`, `minStars`, `updated`, `region`, `q`) · `/repo/[owner]/[name]` shareable card (works without WebGL) · `/about` data + privacy · `/api/search` · `/api/repo/[owner]/[name]`

## Deploying (Vercel Hobby + Supabase free)

1. **Database:** a Neon project, linked here with `.neon` and `neon.ts`. To get the connection strings:
   - Easiest: connect Neon to the Vercel project from Vercel → Storage. Vercel then sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` itself.
   - Or run `neon env pull` and copy both values into Vercel by hand.
2. In Vercel, also set `GITHUB_TOKEN`. Put the function region next to Neon: both are `us-east-1` / `iad1`.
3. Set the build command to `npm run db:deploy && npm run build`.

The prerendered galaxy shell is regenerated in the background. Postgres is the durable cache, so serverless cold starts don't refetch GitHub. If the build can't reach GitHub or the DB, it ships the committed seed and recovers at runtime.

Vercel Hobby is for personal, non-commercial use. Re-check the terms before going commercial.

## Privacy

No accounts, analytics, or cookies. Favorites ("My Universe") and settings live in `localStorage`; they can be exported, imported (validated), or cleared. Search text is forwarded to GitHub's search API and is not logged.

## Adding the next galaxy

1. In `src/lib/galaxy/galaxies.ts`, set `available: true`, then fill in `regionNoun`, `note`, and `regions`. `topicRegion()` covers topic-based systems.
2. Non-spiral shapes get the clustered layout automatically. Spiral galaxies need a band per region in `BANDS`.
3. Run `npm run seed:snapshot -- <slug>` and register the JSON in `src/lib/data/seeds.ts`.

## Known limitations

- Trending is search-based until enough daily snapshots accumulate for measured growth.
- Connections are topic similarity. No dependency graph yet.
- **Journey queries:** each route is one `repo:` OR search. If a stop's repo is renamed or deleted, GitHub rejects the whole query (422) and that galaxy serves its last cached copy.
  - `tests/journeys.test.ts` catches this when the seed is re-captured.
- **Compare tray:** kept in memory only, not persisted.
- **Not built yet:** social preview images.
