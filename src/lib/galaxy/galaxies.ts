import { JOURNEYS, journeyQuery } from "@/lib/discovery/journeys";
import type { Galaxy, RegionDef } from "@/types";

const DAY = 86_400_000;
/** YYYY-MM-DD, n days before `now` (UTC). */
export const daysAgo = (now: Date, n: number) => new Date(now.getTime() - n * DAY).toISOString().slice(0, 10);

/** A region made of one GitHub topic: popular, still maintained. */
function topicRegion(slug: string, title: string, topic: string): RegionDef {
  return {
    slug,
    title,
    definition: (now) => `Tagged with the GitHub topic \u201c${topic}\u201d, at least 200 stars, pushed to on or after ${daysAgo(now, 90)}. Ranked by stars.`,
    query: (now) => `topic:${topic} stars:>=200 pushed:>=${daysAgo(now, 90)} archived:false`,
    sort: "stars",
    limit: 40,
  };
}

export const GALAXIES: Galaxy[] = [
  {
    slug: "trending",
    title: "Trending Galaxy",
    tagline: "Repositories gaining attention right now",
    description:
      "New repositories collecting stars fast, this year's breakout projects that are still shipping, and a frontier of small projects with fresh activity.",
    theme: { accent: "#f5a65b", core: "#ffd9a8", edge: "#7a3df0", shape: "spiral" },
    available: true,
    regionNoun: "Region",
    note: "GitHub has no public \u201ctrending\u201d API, so these are labelled GitHub searches. \u201c+N stars since\u201d appears only once we\u2019ve measured growth from our own daily snapshots.",
    regions: [
      {
        slug: "rising",
        title: "Rising stars",
        definition: (now) =>
          `Repositories created on or after ${daysAgo(now, 30)}, ranked by total stars. Every star they have was earned in the last 30 days.`,
        query: (now) => `created:>=${daysAgo(now, 30)} stars:>=20 archived:false`,
        sort: "stars",
        limit: 100,
      },
      {
        slug: "breakout",
        title: "Breakout year",
        definition: (now) =>
          `Created since ${daysAgo(now, 365)}, at least 1,000 stars, and pushed to on or after ${daysAgo(now, 7)}.`,
        query: (now) => `created:>=${daysAgo(now, 365)} pushed:>=${daysAgo(now, 7)} stars:>=1000 archived:false`,
        sort: "stars",
        limit: 60,
      },
      {
        slug: "frontier",
        title: "Newly discovered",
        definition: (now) =>
          `Smaller projects (30–300 stars) created since ${daysAgo(now, 180)} with a push on or after ${daysAgo(now, 7)}.`,
        query: (now) => `created:>=${daysAgo(now, 180)} pushed:>=${daysAgo(now, 7)} stars:30..300 archived:false`,
        sort: "stars",
        limit: 60,
      },
    ],
  },
  // Charted next. Registered so the universe map and navigation already know them.
  {
    slug: "languages",
    title: "Language Galaxies",
    tagline: "TypeScript, Python, Rust, Go and beyond",
    description: "Regions shaped by a repository's primary language.",
    theme: { accent: "#5bb8f5", core: "#cfeaff", edge: "#2b4fd6", shape: "barred" },
    available: false,
    regionNoun: "Region",
    note: "",
    regions: [],
  },
  {
    slug: "ai",
    title: "AI & Machine Learning",
    tagline: "Models, agents, RAG, evaluation, vision",
    description: "Six star systems, one per GitHub topic: agents, RAG, inference, evaluation, computer vision, and ML foundations.",
    theme: { accent: "#b98bff", core: "#efe2ff", edge: "#5a2bd6", shape: "elliptical" },
    available: true,
    regionNoun: "Category",
    note: "Each star system is one GitHub topic that maintainers chose themselves. A repository joins the first system whose topic it declares, so a RAG agent may sit with the agents. Nothing is inferred from names.",
    regions: [
      topicRegion("agents", "Agents", "ai-agents"),
      topicRegion("rag", "Retrieval & RAG", "rag"),
      topicRegion("inference", "LLM inference & serving", "llm-inference"),
      topicRegion("evaluation", "Evaluation & observability", "llm-evaluation"),
      topicRegion("vision", "Computer vision", "computer-vision"),
      topicRegion("ml", "ML foundations", "machine-learning"),
    ],
  },
  {
    slug: "foundations",
    title: "Foundations",
    tagline: "Frameworks, runtimes, databases, tooling",
    description: "The projects much of modern software stands on.",
    theme: { accent: "#6fe0b6", core: "#d8fff0", edge: "#1f8a7a", shape: "ring" },
    available: false,
    regionNoun: "Region",
    note: "",
    regions: [],
  },
  {
    slug: "hidden-gems",
    title: "Hidden Gems",
    tagline: "Useful projects that aren't huge yet",
    description: "Lower-star projects with explainable, promising signals.",
    theme: { accent: "#f27aa8", core: "#ffd6e6", edge: "#a0306a", shape: "irregular" },
    available: false,
    regionNoun: "Region",
    note: "",
    regions: [],
  },
  {
    slug: "constellations",
    title: "Community Constellations",
    tagline: "Curated routes through the universe",
    description: "Hand-picked collections you can travel as guided journeys.",
    theme: { accent: "#e8e3c8", core: "#fffbe8", edge: "#8a8460", shape: "constellation" },
    available: true,
    regionNoun: "Journey",
    note: "Routes are hand-picked by the Open Source Galaxy editors \u2014 editorial curation, not an algorithm. Each stop says why it\u2019s there.",
    regions: JOURNEYS.map((j) => ({
      slug: j.slug,
      title: j.title,
      definition: () => `Editorial route \u00b7 ${j.stops.length} stops, hand-picked and annotated by our editors.`,
      query: () => journeyQuery(j),
      sort: "stars" as const,
      limit: j.stops.length,
      order: j.stops.map((s) => s.fullName),
    })),
  },
];

export const getGalaxy = (slug: string) => GALAXIES.find((g) => g.slug === slug);
export const DEFAULT_GALAXY = "trending";
