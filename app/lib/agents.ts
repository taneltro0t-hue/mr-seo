import "server-only";
import fs from "node:fs";
import path from "node:path";
import type {
  AgentNode,
  AgentStatus,
  AgentsResponse,
  NewSitePayload,
  SwarmTask,
  TasksResponse,
} from "./types";
import { SEO_ROOT } from "./fs-data";

const LIVE_WINDOW_H = 40; // «жив», если запускался в пределах N часов

function mtime(rel: string): number | null {
  try {
    return fs.statSync(path.join(SEO_ROOT, rel)).mtimeMs;
  } catch {
    return null;
  }
}

/** Самый свежий mtime из списка путей. */
function newestMtime(rels: string[]): number | null {
  const vals = rels.map(mtime).filter((v): v is number => v != null);
  return vals.length ? Math.max(...vals) : null;
}

function fileNonEmpty(rel: string): boolean {
  try {
    return fs.statSync(path.join(SEO_ROOT, rel)).size > 0;
  } catch {
    return false;
  }
}

function agoText(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.round(diff / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24);
  return `${d} дн назад`;
}

/** Последняя сводка Аналитика — путь и краткая выдержка. */
function latestAnalyst(): { mtime: number | null; excerpt: string | null } {
  const dir = path.join(SEO_ROOT, "swarm", "runs");
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}-analyst\.md$/.test(f))
      .sort();
    if (files.length === 0) return { mtime: null, excerpt: null };
    const last = files[files.length - 1];
    const full = path.join(dir, last);
    const md = fs.readFileSync(full, "utf8");
    // первая содержательная строка после «## Сводка»
    const m = md.match(/##\s*Сводка\s*\n+([\s\S]*?)(?:\n##|\n```|$)/);
    const excerpt = (m ? m[1] : md)
      .replace(/[#*`>]/g, "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(" ")
      .slice(0, 260);
    return { mtime: fs.statSync(full).mtimeMs, excerpt };
  } catch {
    return { mtime: null, excerpt: null };
  }
}

function statusFrom(mt: number | null, errRel: string | null, runnable: boolean): AgentStatus {
  if (errRel && fileNonEmpty(errRel)) {
    // ошибка учитывается, только если она свежее суток
    const em = mtime(errRel);
    if (em && Date.now() - em < 24 * 3600 * 1000) return "error";
  }
  if (mt == null) return runnable ? "sleeping" : "scheduled";
  return Date.now() - mt < LIVE_WINDOW_H * 3600 * 1000 ? "live" : "sleeping";
}

export function buildAgents(): AgentsResponse {
  const analyst = latestAnalyst();

  const watchmanMt = newestMtime(["logs/daily-scan.out.log"]);
  const explorerMt = newestMtime([
    "logs/seo-explorer.out.log",
    "logs/research-runner.out.log",
    "logs/github-scanner.out.log",
  ]);

  const agents: AgentNode[] = [
    {
      id: "watchman",
      name: "Сторож",
      role: "Каждый день снимает позиции в Яндекс, Google и Bing и поднимает тревогу, если целевой запрос резко просел.",
      runnable: true,
      status: statusFrom(watchmanMt, "logs/daily-scan.err.log", true),
      schedule: "ежедневно, ~09:30",
      lastRun: watchmanMt ? new Date(watchmanMt).toISOString() : null,
      lastRunAgo: watchmanMt ? agoText(watchmanMt) : null,
      lastResult: watchmanMt ? "Скан позиций и агрегатов записан в daily_snapshots." : null,
      inputLabel: "Поисковики",
      outputLabel: "Снимки позиций",
    },
    {
      id: "analyst",
      name: "Аналитик",
      role: "Читает свежий скан и пишет человеческую сводку: что изменилось, где просто шум окна, а где реальный тренд, и что делать.",
      runnable: true,
      status: statusFrom(analyst.mtime, null, true),
      schedule: "ежедневно, сразу после Сторожа",
      lastRun: analyst.mtime ? new Date(analyst.mtime).toISOString() : null,
      lastRunAgo: analyst.mtime ? agoText(analyst.mtime) : null,
      lastResult: analyst.excerpt,
      inputLabel: "Снимки позиций",
      outputLabel: "Сводка дня",
    },
    {
      id: "explorer",
      name: "Ищейка",
      role: "Дип-ресёрчер: ищет свежие тактики SEO/GEO и новые инструменты, складывает находки в базу знаний без дублей.",
      runnable: false,
      status: statusFrom(explorerMt, "logs/seo-explorer.err.log", false),
      schedule: "по расписанию (Вт/Пт)",
      lastRun: explorerMt ? new Date(explorerMt).toISOString() : null,
      lastRunAgo: explorerMt ? agoText(explorerMt) : null,
      lastResult: explorerMt ? "Находки записаны в knowledge_research/findings." : null,
      inputLabel: "Веб, GitHub",
      outputLabel: "База знаний",
    },
    {
      id: "verifier",
      name: "Верификатор",
      role: "Проверяет гипотезы по окну верификации: подтвердилось ожидание или нет — и записывает урок в кладбище.",
      runnable: false,
      status: "scheduled",
      schedule: "по окну гипотезы / по запросу",
      lastRun: null,
      lastRunAgo: null,
      lastResult: null,
      inputLabel: "Гипотезы",
      outputLabel: "Уроки",
    },
    {
      id: "writer",
      name: "Контентщик",
      role: "Готовит черновики статей и посадочных под найденные запросы — то, что двигает Москву и хвост.",
      runnable: false,
      status: "scheduled",
      schedule: "по запросу",
      lastRun: null,
      lastRunAgo: null,
      lastResult: null,
      inputLabel: "Находки, запросы",
      outputLabel: "Черновики",
    },
  ];

  return { mock: false, agents };
}

/* ------------------------------ Tasks (inbox) ------------------------------ */

const INBOX_REL = path.join("swarm", "tasks", "inbox.md");

export function readTasks(): TasksResponse {
  const full = path.join(SEO_ROOT, INBOX_REL);
  let raw = "";
  try {
    raw = fs.readFileSync(full, "utf8");
  } catch {
    return { tasks: [] };
  }
  // формат строки: «- [YYYY-MM-DDTHH:mm] текст[ → результат]»
  // Выполненные задачи рой дописывает хвостом « → ✓ …» — вырезаем его в result
  // и помечаем задачу как done, чтобы «История» на /today их показала.
  const tasks: SwarmTask[] = [];
  for (const line of raw.split("\n")) {
    const m = line.match(/^- \[([^\]]+)\]\s+(.*)$/);
    if (!m) continue;
    const body = m[2].trim();
    // Маркер выполнения — « → ✓ …» (пробелы вокруг стрелки + галка). Важно не
    // спутать с записью позиций вида «18.5→21» без пробелов внутри текста задачи.
    const arrow = body.search(/\s+→\s+✓/);
    const hasResult = arrow !== -1;
    const text = (hasResult ? body.slice(0, arrow) : body).trim();
    const result = hasResult ? body.slice(arrow).replace(/^\s*→\s*/, "").trim() : undefined;
    tasks.push({
      id: `${m[1]}-${tasks.length}`,
      created: m[1],
      text,
      status: hasResult ? "done" : "queued",
      ...(result ? { result } : {}),
    });
  }
  return { tasks: tasks.reverse() };
}

export function appendTask(text: string): SwarmTask {
  const dir = path.join(SEO_ROOT, "swarm", "tasks");
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, "inbox.md");
  const created = new Date().toISOString().slice(0, 16);
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 600);
  if (!fs.existsSync(full)) {
    fs.writeFileSync(full, "# Очередь задач рою\n\n", "utf8");
  }
  fs.appendFileSync(full, `- [${created}] ${clean}\n`, "utf8");
  return { id: `${created}-new`, created, text: clean, status: "queued" };
}

/** Заявка на подключение нового сайта — отдельной строкой с пометкой [new-site]. */
export function appendNewSite(input: NewSitePayload): SwarmTask {
  const name = input.name.replace(/\s+/g, " ").trim().slice(0, 160);
  const url = input.url.replace(/\s+/g, "").trim().slice(0, 200);
  const conns = input.connections.length ? input.connections.join(", ") : "—";
  const text = `[new-site] ${name} — ${url} · подключения: ${conns}`;
  return appendTask(text);
}
