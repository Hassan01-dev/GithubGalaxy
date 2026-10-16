/**
 * Captures real GitHub data into the committed fallback seed.
 * Run occasionally: `npm run seed:snapshot` (GITHUB_TOKEN optional).
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { GALAXIES } from "@/lib/galaxy/galaxies";
import { fetchGalaxyFromGitHub } from "@/lib/data/github-galaxy";

// Optional slugs limit the run, e.g. `npm run seed:snapshot -- ai` (search is rate-limited to 10/min without a token).
const only = process.argv.slice(2);
for (const g of GALAXIES.filter((g) => g.available && (!only.length || only.includes(g.slug)))) {
  const data = await fetchGalaxyFromGitHub(g, new Date());
  const out = { ...data, source: "seed" };
  writeFileSync(`src/data/seed/${g.slug}.json`, JSON.stringify(out, null, 1) + "\n");
  console.log(g.slug, data.regions.map((r) => `${r.slug}=${r.repos.length}`).join(" "));
}
