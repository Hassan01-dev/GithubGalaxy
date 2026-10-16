import { loadRepo } from "@/lib/data/repo";

export async function GET(_req: Request, ctx: RouteContext<"/api/repo/[owner]/[name]">) {
  const { owner, name } = await ctx.params;
  const result = await loadRepo(owner, name);
  const code = result.status === "ok" ? 200 : result.status === "not_found" ? 404 : 503;
  return Response.json(result, { status: code });
}
