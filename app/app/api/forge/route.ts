import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SEO_AGENT_ROOT = process.env.SEO_AGENT_ROOT ?? path.resolve(process.cwd(), "..");
const PY = path.join(SEO_AGENT_ROOT, "venv", "bin", "python");
const run = promisify(execFile);
const SITE_KEY_RE = /^[a-z0-9_-]{2,24}$/; // ключи из sites_config.py

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const site = String(b?.site ?? ""), query = String(b?.query ?? "").slice(0, 200), url = String(b?.url ?? "").slice(0, 300);
    if (!SITE_KEY_RE.test(site) || query.length < 3) return Response.json({ ok: false, error: "site/query" }, { status: 400 });
    const args = [path.join(SEO_AGENT_ROOT, "swarm", "content_forge.py"), site, query];
    if (url) args.push(url);
    const { stdout } = await run(PY, args, { cwd: SEO_AGENT_ROOT, timeout: 290_000 });
    return Response.json(JSON.parse(stdout.trim()));
  } catch (e) { return Response.json({ ok: false, error: String(e).slice(0, 200) }, { status: 500 }); }
}
