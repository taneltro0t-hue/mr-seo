import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SEO_AGENT_ROOT = process.env.SEO_AGENT_ROOT ?? path.resolve(process.cwd(), "..");
const PY = path.join(SEO_AGENT_ROOT, "venv", "bin", "python");
const run = promisify(execFile);
const SITES = new Set(["mysite", "demo2", "demo3"]);

export async function GET(req: NextRequest) {
  const site = req.nextUrl.searchParams.get("site") ?? "";
  const days = String(Math.min(Number(req.nextUrl.searchParams.get("days") ?? 30) || 30, 90));
  if (!SITES.has(site)) return Response.json({ error: "site=..." }, { status: 400 });
  try {
    const { stdout } = await run(PY, [path.join(SEO_AGENT_ROOT, "swarm", "report.py"), site, days], { cwd: SEO_AGENT_ROOT, timeout: 110_000 });
    return Response.json(JSON.parse(stdout.trim()));
  } catch (e) { return Response.json({ error: String(e).slice(0, 200) }, { status: 500 }); }
}
