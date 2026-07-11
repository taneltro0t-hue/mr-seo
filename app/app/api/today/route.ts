import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEO_AGENT_ROOT = process.env.SEO_AGENT_ROOT ?? path.resolve(process.cwd(), "..");
const PY = path.join(SEO_AGENT_ROOT, "venv", "bin", "python");
const run = promisify(execFile);
const SITE_KEY_RE = /^[a-z0-9_-]{2,24}$/; // ключи из sites_config.py

export async function GET() {
  try {
    const { stdout } = await run(PY, [path.join(SEO_AGENT_ROOT, "swarm", "today.py")], { cwd: SEO_AGENT_ROOT, timeout: 55_000 });
    return Response.json(JSON.parse(stdout.trim()));
  } catch (e) { return Response.json({ error: String(e).slice(0, 200) }, { status: 500 }); }
}
