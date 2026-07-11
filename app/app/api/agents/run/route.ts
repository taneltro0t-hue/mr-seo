import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { SEO_ROOT } from "@/lib/fs-data";

const LOCKS = path.join(SEO_ROOT, "swarm/tasks/agent_locks.json");

function readLocks(): Record<string, { at: string }> {
  try { return JSON.parse(fs.readFileSync(LOCKS, "utf8")); } catch { return {}; }
}
function writeLock(agent: string) {
  const d = readLocks();
  d[agent] = { at: new Date().toISOString() };
  try { fs.mkdirSync(path.dirname(LOCKS), { recursive: true }); fs.writeFileSync(LOCKS, JSON.stringify(d)); } catch {}
}

export function GET() {
  return NextResponse.json({ locks: readLocks() });
}

export const dynamic = "force-dynamic";

// Реально запускаемые агенты и их команды.
const RUNNABLE: Record<string, { args: string[]; msg: string }> = {
  analyst: { args: ["swarm/orchestrator.py", "analyst"], msg: "Аналитик запущен — свежая сводка появится во вкладке «Сводки»." },
  watchman: { args: ["swarm/orchestrator.py", "watchman"], msg: "Сторож запущен — проверка займёт минуту." },
  scan: { args: ["daily_scan.py"], msg: "Скан позиций запущен — данные подтянутся через 2-3 минуты, алерт погаснет сам." },
  verify: { args: ["carpathy/verify.py"], msg: "Verify запущен — вердикты созревших гипотез появятся в Гипотезах." },
};

const SCHEDULED_MSG: Record<string, string> = {
  explorer: "Ищейка ходит по расписанию (Вт/Пт). Ручной запуск подключим позже.",
  verifier: "Верификатор срабатывает по окну гипотезы. Отдельная кнопка появится, когда подключим исполнителя.",
  writer: "Контентщик запускается по задаче — оставьте её в очереди роя ниже.",
};

export async function POST(req: NextRequest) {
  let agent = "";
  try {
    const body = await req.json();
    agent = String(body?.agent ?? "");
  } catch {
    /* ignore */
  }

  if (!(agent in RUNNABLE)) {
    return NextResponse.json({
      status: "scheduled",
      message: SCHEDULED_MSG[agent] ?? "Этот агент пока не запускается вручную.",
    });
  }

  const py = path.join(SEO_ROOT, "venv", "bin", "python");
  const script = path.join(SEO_ROOT, "swarm", "orchestrator.py");
  if (!fs.existsSync(py) || !fs.existsSync(script)) {
    return NextResponse.json({
      status: "unavailable",
      message: "Не найден venv или swarm/orchestrator.py — проверьте окружение seo-agent.",
    });
  }

  try {
    const child = spawn(py, RUNNABLE[agent].args, {
      cwd: SEO_ROOT,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    writeLock(agent);
    return NextResponse.json({ status: "started", message: RUNNABLE[agent].msg });
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e) }, { status: 500 });
  }
}
