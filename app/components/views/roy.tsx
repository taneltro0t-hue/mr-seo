"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Clock, Play, Radio, Send, Sparkles } from "lucide-react";
import { useApi } from "@/components/use-api";
import { useSite } from "@/components/providers";
import { SeoOrb, type OrbTint } from "@/components/seo-orb";
import { GridComets } from "@/components/grid-comets";
import { prefersReducedMotion } from "@/components/orb-ticker";
import { KineticNumber } from "@/components/kinetic-number";
import { PageHead, Panel, SectionLabel, Skeleton } from "@/components/ui";
import type { AgentNode, AgentStatus, AgentsResponse, SwarmTask, TasksResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AgentLiveMetric {
  id: string;
  value: number;
  unit?: string;
  label: string;
  tone: "good" | "ok" | "warn" | "neutral";
}
interface AgentMetricsResponse {
  metrics: AgentLiveMetric[];
}

const STATUS: Record<AgentStatus, { label: string; color: string; tone: string; tint: OrbTint }> = {
  live: { label: "в работе", color: "#4bd39a", tone: "good", tint: "good" },
  sleeping: { label: "спит", color: "#9aa5b2", tone: "muted", tint: "neutral" },
  error: { label: "ошибка", color: "#ff6b6b", tone: "warn", tint: "warn" },
  scheduled: { label: "по расписанию", color: "#8b93ff", tone: "iris", tint: "neutral" },
};

const METRIC_COLOR: Record<AgentLiveMetric["tone"], string> = {
  good: "#4bd39a",
  ok: "#f4c25a",
  warn: "#ff6b6b",
  neutral: "#8b93ff",
};

// Пентагон вокруг центра (проценты контейнера).
function nodePos(i: number, n: number) {
  const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
  return { x: 50 + 32 * Math.cos(angle), y: 50 + 33 * Math.sin(angle) };
}

export function RoyView() {
  const { tint } = useSite();
  const { data, loading } = useApi<AgentsResponse>("/api/agents");
  const { data: metricsData } = useApi<AgentMetricsResponse>("/api/agents/metrics");
  const [selected, setSelected] = useState<string | null>(null);

  const agents = data?.agents ?? [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const positions = useMemo(() => agents.map((_, i) => nodePos(i, agents.length)), [agents.length]);
  const active = agents.find((a) => a.id === selected) ?? agents[0] ?? null;

  const metricById = useMemo(() => {
    const m = new Map<string, AgentLiveMetric>();
    for (const it of metricsData?.metrics ?? []) m.set(it.id, it);
    return m;
  }, [metricsData]);

  const working = agents.filter((a) => a.status === "live").length;
  const anyError = agents.some((a) => a.status === "error");
  const centerTint: OrbTint = anyError ? "warn" : tint;
  const reduced = prefersReducedMotion();

  if (loading || !data) return <RoySkeleton />;

  return (
    <div className="space-y-10">
      <PageHead
        eyebrow="Живые агенты продукта"
        title="Рой"
        lede="Пять агентов работают на ваше SEO: снимают позиции, объясняют, ищут тактики, проверяют гипотезы и пишут контент. Кликните узел — увидите, что он делает, и запустите вручную."
      />

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* Topology stage */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, filter: "blur(6px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <Panel className="relative h-[500px] overflow-hidden p-4">
            {/* retro grid + comets (hero-зона) */}
            <GridComets color="139,147,255" step={44} />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_50%,rgba(139,147,255,0.12),transparent_70%)]" />

            {/* links + бегущие импульсы данных */}
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {positions.map((p, i) => (
                <LinkImpulse key={agents[i].id} pos={p} status={agents[i].status} index={i} reduced={reduced} />
              ))}
            </svg>

            {/* center hub — единственный дышащий орб сцены */}
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
              <SeoOrb size={96} tint={centerTint} state={anyError ? "alert" : "idle"} hero interactive />
              <div className="mt-2 font-display text-sm font-600">Mr.Seo</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-faint">оркестратор</div>
            </div>

            {/* nodes */}
            {agents.map((a, i) => (
              <AgentNodeDot
                key={a.id}
                agent={a}
                pos={positions[i]}
                metric={metricById.get(a.id) ?? null}
                selected={active?.id === a.id}
                onClick={() => setSelected(a.id)}
              />
            ))}
          </Panel>
        </motion.div>

        {/* Agent detail */}
        <AnimatePresence mode="wait">
          {active && <AgentDetail key={active.id} agent={active} metric={metricById.get(active.id) ?? null} />}
        </AnimatePresence>
      </div>

      {/* live status line */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span
          className="warm-pulse h-1.5 w-1.5 rounded-full"
          style={{ background: anyError ? "#ff6b6b" : "#4bd39a" }}
        />
        <span className="mono">
          Рой: {working} {working === 1 ? "агент работает" : working < 5 ? "агента работают" : "агентов работают"}
        </span>
        <span className="text-faint">·</span>
        <span className="mono text-faint">{agents.length} узлов в топологии</span>
      </div>

      {/* Task queue */}
      <TaskQueue />
    </div>
  );
}

/* --------- Импульс по связи графа: комета с хвостом hub → node,
   + возврат «цепь замыкается» node → hub у активных агентов. --------- */

function LinkImpulse({
  pos,
  status,
  index,
  reduced,
}: {
  pos: { x: number; y: number };
  status: AgentStatus;
  index: number;
  reduced: boolean;
}) {
  const c = STATUS[status].color;
  const live = status === "live";
  const dur = live ? 2.4 + index * 0.3 : 4.2 + index * 0.4;
  // хвост кометы — 3 звена с нарастающей задержкой и падающей яркостью
  const trail = [
    { r: 0.75, o: 1, d: 0 },
    { r: 0.5, o: 0.5, d: 0.06 },
    { r: 0.32, o: 0.26, d: 0.12 },
  ];

  if (reduced) {
    return (
      <g>
        <line
          x1="50" y1="50" x2={pos.x} y2={pos.y}
          stroke="rgba(255,255,255,0.09)" strokeWidth={0.35}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="50" y1="50" x2={pos.x} y2={pos.y}
          stroke={c} strokeWidth={0.5} strokeOpacity={live ? 0.45 : 0.24}
          strokeDasharray="1.5 3"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={pos.x} cy={pos.y} r={0.6} fill={c} />
      </g>
    );
  }

  return (
    <g>
      <line
        x1="50" y1="50" x2={pos.x} y2={pos.y}
        stroke="rgba(255,255,255,0.09)" strokeWidth={0.35}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1="50" y1="50" x2={pos.x} y2={pos.y}
        stroke={c} strokeWidth={0.5} strokeOpacity={live ? 0.5 : 0.28}
        strokeDasharray="1.5 3"
        vectorEffect="non-scaling-stroke"
        style={{ animation: `dash-flow ${(live ? 16 : 26) + index * 3}s linear infinite` }}
      />
      {/* outbound комета с хвостом */}
      {trail.map((seg, k) => (
        <circle key={k} r={seg.r} fill={c}>
          <animate attributeName="cx" values={`50;${pos.x}`} dur={`${dur}s`} begin={`${index * 0.5 + seg.d}s`} repeatCount="indefinite" />
          <animate attributeName="cy" values={`50;${pos.y}`} dur={`${dur}s`} begin={`${index * 0.5 + seg.d}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values={`0;${seg.o};${seg.o};0`} keyTimes="0;0.12;0.8;1" dur={`${dur}s`} begin={`${index * 0.5 + seg.d}s`} repeatCount="indefinite" />
        </circle>
      ))}
      {/* return: цепь замыкается обратно к центру (только у активных) */}
      {live && (
        <circle r="0.55" fill="#eef0ff">
          <animate attributeName="cx" values={`${pos.x};50`} dur={`${dur}s`} begin={`${index * 0.5 + dur * 0.5}s`} repeatCount="indefinite" />
          <animate attributeName="cy" values={`${pos.y};50`} dur={`${dur}s`} begin={`${index * 0.5 + dur * 0.5}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.15;0.75;1" dur={`${dur}s`} begin={`${index * 0.5 + dur * 0.5}s`} repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
}

function AgentNodeDot({
  agent,
  pos,
  metric,
  selected,
  onClick,
}: {
  agent: AgentNode;
  pos: { x: number; y: number };
  metric: AgentLiveMetric | null;
  selected: boolean;
  onClick: () => void;
}) {
  const st = STATUS[agent.status];
  const mColor = metric ? METRIC_COLOR[metric.tone] : st.color;
  return (
    <button
      onClick={onClick}
      className="focus-ring group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
    >
      <motion.span
        whileHover={{ scale: 1.1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        className="relative flex items-center justify-center rounded-full"
        style={selected ? { filter: `drop-shadow(0 0 14px ${st.color}aa)` } : undefined}
      >
        {/* орб-агент своего цвета/состояния */}
        <SeoOrb
          size={selected ? 52 : 46}
          tint={st.tint}
          state={agent.status === "error" ? "alert" : "idle"}
        />
        <span
          className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-base"
          style={{ background: st.color }}
        />
      </motion.span>

      {/* живая цифра — данные дышат прямо на орбе */}
      {metric && (
        <motion.span
          key={metric.value}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          className="mono flex items-baseline gap-0.5 leading-none"
          style={{ color: mColor }}
        >
          <span className="text-[15px] font-600">
            <KineticNumber value={metric.value} duration={1} />
          </span>
          {metric.unit && <span className="text-[10px] opacity-80">{metric.unit}</span>}
        </motion.span>
      )}

      <span className="flex flex-col items-center">
        <span className={cn("text-[13px] font-600", selected ? "text-ink" : "text-muted")}>
          {agent.name}
        </span>
        <span className="text-[9px] leading-tight" style={{ color: mColor }}>
          {metric ? metric.label : st.label}
        </span>
      </span>
    </button>
  );
}

function AgentDetail({ agent, metric }: { agent: AgentNode; metric: AgentLiveMetric | null }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const st = STATUS[agent.status];

  const run = async () => {
    setRunning(true);
    setMsg(null);
    try {
      const r = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: agent.id }),
      });
      const j = await r.json();
      setMsg(j.message ?? "Готово.");
    } catch {
      setMsg("Не удалось связаться с агентом.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="surface-line h-full p-7">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl border"
            style={{ borderColor: `${st.color}55`, background: `${st.color}18` }}
          >
            <Radio size={18} style={{ color: st.color }} />
          </span>
          <div>
            <div className="font-display text-xl font-600">{agent.name}</div>
            <div className="text-xs" style={{ color: st.color }}>
              {st.label}
            </div>
          </div>
          {metric && (
            <div
              className="ml-auto flex flex-col items-end rounded-xl border px-3 py-1.5"
              style={{ borderColor: `${METRIC_COLOR[metric.tone]}33`, background: `${METRIC_COLOR[metric.tone]}10` }}
            >
              <span className="mono text-lg font-600 leading-none" style={{ color: METRIC_COLOR[metric.tone] }}>
                <KineticNumber value={metric.value} duration={1} />
                {metric.unit}
              </span>
              <span className="mt-0.5 text-[10px] text-faint">{metric.label}</span>
            </div>
          )}
        </div>

        <p className="mt-5 text-[15px] leading-relaxed text-muted">{agent.role}</p>

        {/* flow chips */}
        <div className="mt-5 flex items-center gap-2 text-xs">
          <span className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5 text-muted">
            {agent.inputLabel}
          </span>
          <span className="text-faint">→</span>
          <span className="rounded-lg border border-iris/30 bg-iris/10 px-2.5 py-1.5 font-600 text-iris">
            {agent.name}
          </span>
          <span className="text-faint">→</span>
          <span className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5 text-muted">
            {agent.outputLabel}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-line bg-white/[0.02] p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] text-faint">
              <Clock size={12} /> Последний запуск
            </div>
            <div className="mt-1 font-600">{agent.lastRunAgo ?? "нет данных"}</div>
          </div>
          <div className="rounded-xl border border-line bg-white/[0.02] p-3.5">
            <div className="text-[11px] text-faint">Расписание</div>
            <div className="mt-1 font-600">{agent.schedule}</div>
          </div>
        </div>

        {agent.lastResult && (
          <div className="mt-3 rounded-xl border border-line bg-white/[0.02] p-3.5">
            <div className="mb-1 text-[11px] text-faint">Последний результат</div>
            <p className="text-[13px] leading-relaxed text-muted">{agent.lastResult}</p>
          </div>
        )}

        <div className="mt-6">
          {agent.runnable ? (
            <button
              onClick={run}
              disabled={running}
              className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl bg-iris py-3 font-600 text-base-2 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Play size={16} /> {running ? "Запускаю…" : "Запустить сейчас"}
            </button>
          ) : (
            <button
              onClick={run}
              disabled={running}
              className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white/[0.03] py-3 font-600 text-muted transition-colors hover:text-ink"
            >
              <Sparkles size={15} /> Как запускается
            </button>
          )}
          <AnimatePresence>
            {msg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 rounded-xl border border-iris/25 bg-iris/[0.08] px-4 py-3 text-sm text-ink/90"
              >
                {msg}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------ Task queue ------------------------------ */

function TaskQueue() {
  const { data, loading } = useApi<TasksResponse>("/api/tasks");
  const [tasks, setTasks] = useState<SwarmTask[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const list = tasks ?? data?.tasks ?? [];

  const submit = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const j = await r.json();
      if (j.task) setTasks([j.task, ...list]);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="surface-line p-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionLabel className="mb-3">Дать задачу рою</SectionLabel>
            <p className="mb-4 text-sm text-muted">
              Опишите, что нужно сделать по SEO. Задача уходит в очередь роя — исполнитель разберёт её
              следующим прогоном.
            </p>
            <div className="rounded-2xl border border-line bg-white/[0.02] p-3 focus-within:border-iris/40">
              <textarea
                name="roy-task"
                autoComplete="off"
                aria-label="Задача для роя"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
                }}
                rows={3}
                placeholder="Напр.: собрать 20 запросов для блога low-light про сведение вокала"
                className="w-full resize-none bg-transparent px-2 py-1 text-sm text-ink placeholder:text-faint focus:outline-none"
              />
              <div className="flex items-center justify-between px-2 pt-1">
                <span className="text-[11px] text-faint">⌘/Ctrl + Enter</span>
                <button
                  onClick={submit}
                  disabled={!text.trim() || sending}
                  className="focus-ring flex items-center gap-1.5 rounded-lg bg-iris px-3.5 py-2 text-sm font-600 text-base-2 transition-opacity disabled:opacity-40"
                >
                  <Send size={14} /> В очередь
                </button>
              </div>
            </div>
          </div>

          <div>
            <SectionLabel className="mb-3">Принятые задачи</SectionLabel>
            <div className="max-h-[260px] space-y-2.5 overflow-y-auto pr-1">
              {loading && !tasks ? (
                <Skeleton className="h-16" />
              ) : list.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-faint">
                  Пока пусто. Первая задача появится здесь.
                </div>
              ) : (
                list.map((t) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-3"
                  >
                    <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-ok" />
                    <div className="min-w-0">
                      <p className="text-sm leading-snug text-ink/90">{t.text}</p>
                      <div className="mono mt-1 flex items-center gap-2 text-[10px] text-faint">
                        <span>{t.created.replace("T", " ")}</span>
                        <span className="rounded border border-ok/25 bg-ok/10 px-1.5 text-ok">
                          в очереди
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function RoySkeleton() {
  return (
    <div className="space-y-10">
      <Skeleton className="h-16 w-64" />
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Skeleton className="h-[500px]" />
        <Skeleton className="h-[500px]" />
      </div>
      <Skeleton className="h-56" />
    </div>
  );
}
