import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** Конвейер деплоев роя.
 *  GET  /api/deploys → {pending, merged}
 *  POST /api/deploys {site, branch} → merge в 1 клик (только mrseo/*) */
const SEO_AGENT_ROOT = process.env.SEO_AGENT_ROOT ?? path.resolve(process.cwd(), "..");
const PY = path.join(SEO_AGENT_ROOT, "venv", "bin", "python");
const SCRIPT = path.join(SEO_AGENT_ROOT, "swarm", "deploys.py");
const run = promisify(execFile);
const SITE_KEY_RE = /^[a-z0-9_-]{2,24}$/;
const BRANCH_RE = /^mrseo\/[A-Za-z0-9._\/-]{2,60}$/;

export async function GET() {
  try {
    const { stdout } = await run(PY, [SCRIPT, "list"], { cwd: SEO_AGENT_ROOT, timeout: 60_000 });
    return Response.json(JSON.parse(stdout.trim()));
  } catch (e) {
    return Response.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const site = String(b?.site ?? ""), branch = String(b?.branch ?? "");
    if (!SITE_KEY_RE.test(site) || !BRANCH_RE.test(branch)) {
      return Response.json({ ok: false, error: "неверные site/branch" }, { status: 400 });
    }
    const { stdout } = await run(PY, [SCRIPT, "merge", site, branch], { cwd: SEO_AGENT_ROOT, timeout: 170_000 });
    return Response.json(JSON.parse(stdout.trim()));
  } catch (e) {
    return Response.json({ ok: false, error: String(e).slice(0, 200) }, { status: 500 });
  }
}
