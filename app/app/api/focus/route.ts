import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

export const dynamic = "force-dynamic";
export const maxDuration = 500;

const SEO_AGENT_ROOT = process.env.SEO_AGENT_ROOT ?? path.resolve(process.cwd(), "..");
const run = promisify(execFile);

/** Фокус недели: недельный кеш-файл отдаётся мгновенно, генерация — по крону. */
export async function GET() {
  try {
    const { stdout } = await run(path.join(SEO_AGENT_ROOT, "venv", "bin", "python"),
      [path.join(SEO_AGENT_ROOT, "swarm", "focus.py")], { cwd: SEO_AGENT_ROOT, timeout: 490_000 });
    return Response.json(JSON.parse(stdout.trim()));
  } catch (e) {
    return Response.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
