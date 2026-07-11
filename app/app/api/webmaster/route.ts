import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Вебмастер-инсайты (swarm/yandex_webmaster.py):
 *  GET /api/webmaster?kind=excluded|sqi|links&site=... */
const SEO_AGENT_ROOT =
  process.env.SEO_AGENT_ROOT ?? path.resolve(process.cwd(), "..");
const PY = path.join(SEO_AGENT_ROOT, "venv", "bin", "python");
const SCRIPT = path.join(SEO_AGENT_ROOT, "swarm", "yandex_webmaster.py");
const run = promisify(execFile);
const SITE_KEY_RE = /^[a-z0-9_-]{2,24}$/; // ключи из sites_config.py
const KINDS = new Set(["excluded", "sqi", "links"]);

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind") ?? "";
  const site = req.nextUrl.searchParams.get("site") ?? "";
  if (!KINDS.has(kind) || !SITE_KEY_RE.test(site)) {
    return Response.json({ error: "kind=excluded|sqi|links & site=..." }, { status: 400 });
  }
  try {
    const { stdout } = await run(PY, [SCRIPT, kind, site], { cwd: SEO_AGENT_ROOT, timeout: 55_000 });
    return Response.json(JSON.parse(stdout.trim()));
  } catch (e) {
    return Response.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
