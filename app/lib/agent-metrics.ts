import "server-only";
import fs from "node:fs";
import path from "node:path";
import { SEO_ROOT } from "./fs-data";
import { buildNodes } from "./nodes";
import { buildHypotheses } from "./hypotheses";
import { readTasks, buildAgents } from "./agents";

// Живые метрики агентов Роя. Считаются из тех же реальных файлов, что и
// остальные ручки — read-only, существующие lib не изменяются.

export type MetricTone = "good" | "ok" | "warn" | "neutral";

export interface AgentLiveMetric {
  id: string;
  value: number;
  unit?: string;
  label: string;
  tone: MetricTone;
}

export interface AgentMetricsResponse {
  metrics: AgentLiveMetric[];
}

/** Сколько находок в базе знаний Ищейки (файлы в knowledge_research/findings). */
function countFindings(): number {
  const dir = path.join(SEO_ROOT, "knowledge_research", "findings");
  let n = 0;
  try {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (d.isDirectory()) {
        try {
          n += fs.readdirSync(path.join(dir, d.name)).filter((f) => f.endsWith(".md")).length;
        } catch {
          /* пропускаем нечитаемую подпапку */
        }
      } else if (d.name.endsWith(".md")) {
        n += 1;
      }
    }
  } catch {
    /* директории может не быть */
  }
  return n;
}

export function buildAgentMetrics(): AgentMetricsResponse {
  const nodes = buildNodes();
  const liveSources = nodes.groups.reduce(
    (a, g) => a + g.nodes.filter((n) => n.state === "live").length,
    0
  );
  const totalSources = nodes.groups.reduce((a, g) => a + g.nodes.length, 0);

  const hyp = buildHypotheses();
  const tasks = readTasks();
  const agents = buildAgents().agents;

  const analyst = agents.find((a) => a.id === "analyst");
  let hoursSince = 0;
  if (analyst?.lastRun) {
    hoursSince = Math.max(
      0,
      Math.round((Date.now() - new Date(analyst.lastRun).getTime()) / 3_600_000)
    );
  }

  const findings = countFindings();

  const metrics: AgentLiveMetric[] = [
    {
      id: "watchman",
      value: liveSources,
      unit: `/${totalSources}`,
      label: "источников на связи",
      tone: liveSources >= totalSources - 1 ? "good" : liveSources > totalSources / 2 ? "ok" : "warn",
    },
    {
      id: "analyst",
      value: hoursSince,
      unit: " ч",
      label: "с последней сводки",
      tone: hoursSince <= 26 ? "good" : hoursSince <= 50 ? "ok" : "warn",
    },
    {
      id: "explorer",
      value: findings,
      label: "находок в базе",
      tone: "good",
    },
    {
      id: "verifier",
      value: hyp.stats.active,
      label: "гипотез в проверке",
      tone: hyp.stats.active > 0 ? "ok" : "neutral",
    },
    {
      id: "writer",
      value: tasks.tasks.length,
      label: "задач в очереди",
      tone: tasks.tasks.length > 0 ? "ok" : "neutral",
    },
  ];

  return { metrics };
}
