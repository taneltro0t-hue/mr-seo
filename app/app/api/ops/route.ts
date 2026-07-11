import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Пульт экосистемы: операции через swarm/ops.py.
 * GET  /api/ops            → статус токенов/ключей всех источников
 * POST /api/ops {action}   → gsc_reauth | recrawl {site,url} | recrawl_quota {site}
 */
const SEO_AGENT_ROOT =
  process.env.SEO_AGENT_ROOT ?? path.resolve(process.cwd(), "..");
const PY = path.join(SEO_AGENT_ROOT, "venv", "bin", "python");
const OPS = path.join(SEO_AGENT_ROOT, "swarm", "ops.py");
const run = promisify(execFile);

const SITE_KEY_RE = /^[a-z0-9_-]{2,24}$/;

async function ops(args: string[], timeout = 90_000) {
  const { stdout } = await run(PY, [OPS, ...args], {
    cwd: SEO_AGENT_ROOT,
    timeout,
  });
  return JSON.parse(stdout.trim());
}

let _statusCache: { at: number; data: unknown } | null = null;
const STATUS_TTL_MS = 60_000; // токены не меняются посекундно — не мучаем API при каждом входе

export async function GET() {
  try {
    if (_statusCache && Date.now() - _statusCache.at < STATUS_TTL_MS) {
      return Response.json(_statusCache.data);
    }
    const data = await ops(["status"]);
    _statusCache = { at: Date.now(), data };
    return Response.json(data);
  } catch (e) {
    return Response.json({ ok: false, error: String(e).slice(0, 200) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body?.action ?? "");
    if (action === "gsc_reauth") {
      return Response.json(await ops(["gsc_reauth"]));
    }
    if (action === "recrawl") {
      const site = String(body?.site ?? "");
      const url = String(body?.url ?? "");
      if (!ALLOWED_SITE_KEY_RE.test(site) || !/^https?:\/\//.test(url)) {
        return Response.json({ ok: false, error: "неверный site/url" }, { status: 400 });
      }
      return Response.json(await ops(["recrawl", site, url]));
    }
    if (action === "recrawl_quota") {
      const site = String(body?.site ?? "");
      if (!ALLOWED_SITE_KEY_RE.test(site)) {
        return Response.json({ ok: false, error: "неверный site" }, { status: 400 });
      }
      return Response.json(await ops(["recrawl_quota", site]));
    }
    if (action === "aibots") {
      const site = String(body?.site ?? "");
      if (!ALLOWED_SITE_KEY_RE.test(site)) {
        return Response.json({ ok: false, error: "неверный site" }, { status: 400 });
      }
      return Response.json(await ops(["aibots", site]));
    }
    if (action === "indexnow") {
      const site = String(body?.site ?? "");
      const url = String(body?.url ?? "");
      if (!ALLOWED_SITE_KEY_RE.test(site) || !/^https?:\/\//.test(url)) {
        return Response.json({ ok: false, error: "неверный site/url" }, { status: 400 });
      }
      return Response.json(await ops(["indexnow", site, url]));
    }
    if (action === "set_bing_key") {
      const key = String(body?.key ?? "");
      if (!/^[A-Za-z0-9-]{16,128}$/.test(key)) {
        return Response.json({ ok: false, error: "неверный формат ключа" }, { status: 400 });
      }
      return Response.json(await ops(["set_bing_key", key]));
    }
    return Response.json({ ok: false, error: `неизвестное действие: ${action}` }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: String(e).slice(0, 200) }, { status: 500 });
  }
}
