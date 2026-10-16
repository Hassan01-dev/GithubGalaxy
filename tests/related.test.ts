import { expect, it } from "vitest";
import { related, strongestLinks } from "@/lib/discovery/related";
import { repo } from "./fixtures";

const a = repo({ id: 1, topics: ["ai", "rag", "cli"] });
const b = repo({ id: 2, topics: ["ai", "rag"], stars: 10 });
const c = repo({ id: 3, topics: ["ai"], stars: 999 });
const d = repo({ id: 4, topics: ["games"] });

it("ranks by shared topics and never links unrelated repos", () => {
  expect(related(a, [a, b, c, d]).map((r) => [r.repo.id, r.shared])).toEqual([[2, ["ai", "rag"]], [3, ["ai"]]]);
});

it("strongestLinks honours the minimum overlap", () => {
  expect(strongestLinks([a, b, c, d])).toEqual([[1, 2, 2]]);
});
