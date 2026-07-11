import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Рабочие инсайты (swarm/insights.py):
 * GET /api/insights?kind=quick_wins|query_page&site=...   |   ?kind=reviews
 */
const SEO_AGENT_ROOT =
  process.env.SEO_AGENT_ROOT ?? path.resolve(process.cwd(), "..");
const PY = path.join(SEO_AGENT_ROOT, "venv", "bin", "python");
const SCRIPT = path.join(SEO_AGENT_ROOT, "swarm", "insights.py");
const run = promisify(execFile);
const SITES = new Set(["mysite", "demo2", "demo3"]);

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind") ?? "reviews";
  const site = req.nextUrl.searchParams.get("site") ?? "";
  const args =
    kind === "reviews" ? ["reviews"]
    : ["quick_wins", "query_page", "cannibalization", "decay"].includes(kind) && SITES.has(site) ? [kind, site]
    : null;
  if (!args) {
    return Response.json({ error: "kind=quick_wins|query_page|cannibalization|decay&site=… или kind=reviews" }, { status: 400 });
  }
  try {
    const { stdout } = await run(PY, [SCRIPT, ...args], { cwd: SEO_AGENT_ROOT, timeout: 110_000 });
    return Response.json(JSON.parse(stdout.trim()));
  } catch (e) {
    return Response.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
