import type { NextRequest } from "next/server";
import { searchGitHub } from "@/lib/data/search";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 100);
  if (q.length < 2) return Response.json({ status: "ok", repos: [] });
  const result = await searchGitHub(q);
  const code = result.status === "ok" ? 200 : result.status === "rate_limited" ? 429 : 502;
  return Response.json(result, { status: code });
}
