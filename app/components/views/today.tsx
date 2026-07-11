"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
  FileText,
  FlaskConical,
  GitMerge,
  History,
  ListChecks,
  MessageSquareText,
  Moon,
  Send,
  Sparkles,
  TriangleAlert,
Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useApi } from "@/components/use-api";
import { SeoOrb } from "@/components/seo-orb";
import { WeekFocus } from "@/components/views/today-focus";
import { DispatchButton, plural } from "@/components/views/dashboard-insights";
import { notifyTodayActions } from "@/components/notify-bell";
import { CopyButton, IndexTag, PageHead, SectionLabel, Skeleton } from "@/components/ui";
import type { SwarmTask, TasksResponse, TodayAction, TodayActionKind, TodayNight, TodayResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND: Record<TodayActionKind, { label: string; color: string; Icon: LucideIcon }> = {
  alert: { label: "Тревога", color: "#ff6b6b", Icon: TriangleAlert },
  merge: { label: "Слить ветку", color: "#8b93ff", Icon: GitMerge },
  review: { label: "Ответить", color: "#f4c25a", Icon: MessageSquareText },
  draft: { label: "Черновик", color: "#38e8d0", Icon: FileText },
  verify: { label: "Проверить", color: "#8b93ff", Icon: FlaskConical },
  task: { label: "В очереди", color: "rgba(255,255,255,0.42)", Icon: ListChecks },
};

/** alert всегда сверху, дальше по возрастанию priority (1 = высший). */
function sortActions(actions: TodayAction[]): TodayAction[] {
  return [...actions]
    .map((a, i) => ({ a, i }))
    .sort((x, y) => {
      const ax = x.a.kind === "alert" ? -1 : 0;
      const ay = y.a.kind === "alert" ? -1 : 0;
      if (ax !== ay) return ax - ay;
      if (x.a.priority !== y.a.priority) return x.a.priority - y.a.priority;
      return x.i - y.i;
    })
    .map((o) => o.a);
}

export function TodayView() {
  const { data, loading } = useApi<TodayResponse>("/api/today");
  const actionCount = data?.actions?.length ?? 0;

  // web-уведомление о делах дня (троттл 4ч внутри)
  useEffect(() => {
    if (!loading && data) notifyTodayActions(actionCount);
  }, [loading, data, actionCount]);

  if (loading || !data) return <TodaySkeleton />;

  const actions = sortActions(data.actions ?? []);
  const night = data.night ?? [];

  return (
    <div className="space-y-12 lg:space-y-16">
      <PageHead
        eyebrow="Утренняя сводка"
        title="Сегодня"
        lede="Что рой сделал ночью и что ждёт вашего клика. За полминуты — вся картина дня."
        right={<span className="cap rounded-full border border-line px-2.5 py-1 text-faint">скан {data.date}</span>}
      />

      {/* ГЕРОЙ — фокус недели: три директивы максимальной отдачи */}
      <WeekFocus />

      <div className="grid gap-x-10 gap-y-12 lg:grid-cols-2">
        {/* ЛЕВО — ночная лента роя */}
        <section className="min-w-0">
          <div className="mb-5 flex items-baseline gap-3">
            <IndexTag n="01" />
            <SectionLabel>Ночью рой сделал</SectionLabel>
            <span className="mono text-[11px] text-faint">{night.length || "—"}</span>
          </div>
          {night.length === 0 ? (
            <EmptyState
              Icon={Moon}
              title="Рой спал"
              body="За ночь не было ни сканов, ни правок. Ближайший цикл соберёт свежие данные автоматически."
            />
          ) : (
            <div className="flex flex-col">
              {night.map((n, i) => (
                <NightRow key={i} item={n} index={i} />
              ))}
            </div>
          )}
        </section>

        {/* ПРАВО — что ждёт клика */}
        <section className="min-w-0">
          <div className="mb-5 flex items-baseline gap-3">
            <IndexTag n="02" />
            <SectionLabel>Ждёт твоего клика</SectionLabel>
            <span className="mono text-[11px] text-faint">{actions.length || "—"}</span>
          </div>
          {actions.length === 0 ? (
            <EmptyState
              Icon={Sparkles}
              title="Inbox zero — всё разгребено 🎉"
              body="Ни одной задачи, требующей вашего решения. Рой продолжает работать в фоне — новые появятся здесь."
              tone="good"
            />
          ) : (
            <div className="flex flex-col gap-3">
              {actions.map((a, i) => (
                <ActionCard key={i} action={a} index={i} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ИСТОРИЯ РОЯ — свёрнутая лента выполненного */}
      <RoyHistory />
    </div>
  );
}

/* ------------------------------ Ночная лента ------------------------------ */

function NightRow({ item, index }: { item: TodayNight; index: number }) {
  const base = item.ref ? item.ref.split("/").pop() ?? item.ref : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "grid grid-cols-[auto_1fr] items-start gap-x-4 py-4",
        index > 0 && "border-t border-line"
      )}
    >
      {/* временная колонка — таймлайн ночи */}
      <div className="flex flex-col items-end pt-0.5">
        <span className="mono tabular text-[12px] font-600 text-ink">{item.time || "—"}</span>
      </div>
      <div className="min-w-0">
        <div className="text-[14px] leading-snug text-muted">{item.what}</div>
        {base && <div className="mono mt-1 truncate text-[10px] text-ghost" title={item.ref}>{base}</div>}
      </div>
    </motion.div>
  );
}

/* ------------------------------ Карточки-действия ------------------------------ */

function RunFixButton({ agent, label }: { agent: string; label: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");
  const [msg, setMsg] = useState("");
  const fire = async () => {
    if (state === "busy" || state === "done") return;
    setState("busy");
    try {
      const r = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent }),
      });
      const d = await r.json();
      if (d.status === "started") { setState("done"); setMsg(d.message ?? "запущено"); }
      else { setState("err"); setMsg(d.message ?? "не вышло"); }
    } catch (e) {
      setState("err"); setMsg(String(e).slice(0, 80));
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <button
        onClick={fire}
        disabled={state === "busy" || state === "done"}
        className={cn(
          "focus-ring inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-600 transition-opacity",
          state === "done" ? "bg-good/15 text-good" : "bg-iris text-base-2 hover:opacity-90",
          state === "busy" && "opacity-60"
        )}
      >
        <Wrench size={13} className={state === "busy" ? "animate-spin" : undefined} />
        {state === "done" ? "✓ запущено" : state === "busy" ? "запускаю…" : label}
      </button>
      {msg && <span className="text-[11px] leading-snug text-faint">{msg}</span>}
    </div>
  );
}

function ActionCard({ action, index }: { action: TodayAction; index: number }) {
  const meta = KIND[action.kind] ?? KIND.task;
  const { Icon, color, label } = meta;
  const isAlert = action.kind === "alert";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.55, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "surface-line relative overflow-hidden p-5",
        isAlert && "border-warn/30 bg-warn/[0.04]"
      )}
    >
      {/* левый тональный шов */}
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: color, boxShadow: isAlert ? `0 0 14px ${color}88` : undefined }}
      />
      <div className="flex items-center gap-2.5 pl-2">
        <Icon size={15} style={{ color }} />
        <span className="cap" style={{ color }}>
          {label}
        </span>
        <span className="mono ml-auto text-[10px] text-ghost">P{action.priority}</span>
      </div>

      <h3 className="mt-3 pl-2 text-[15px] font-600 leading-snug text-ink">{action.title}</h3>

      {/* fix — рой чинит по клику: запуск агента или задача в очередь */}
      {action.fix && (
        <div className="mt-4 pl-2">
          {action.fix.type === "run" && action.fix.agent ? (
            <RunFixButton agent={action.fix.agent} label={action.fix.label} />
          ) : action.fix.task ? (
            <DispatchButton text={action.fix.task} idleLabel={action.fix.label} doneLabel="рой займётся" Icon={Wrench} />
          ) : null}
        </div>
      )}

      {/* merge — команда с копированием */}
      {action.kind === "merge" && action.hint && (
        <div className="mt-4 pl-2">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-black/40 px-3 py-2.5">
            <code className="mono min-w-0 flex-1 truncate text-[11.5px] text-iris/90" title={action.hint}>
              {action.hint}
            </code>
            <CopyButton value={action.hint} label="Копировать" className="flex-none text-[11px]" />
          </div>
        </div>
      )}

      {/* review — ссылка «Ответить» */}
      {action.kind === "review" && action.url && (
        <div className="mt-4 pl-2">
          <a
            href={action.url}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-ok px-3.5 py-2 text-[12px] font-600 text-base-2 transition-opacity hover:opacity-90"
          >
            <MessageSquareText size={13} /> Ответить
          </a>
        </div>
      )}

      {/* draft — путь файла + перенос в блог */}
      {action.kind === "draft" && (
        <div className="mt-3 space-y-2.5 pl-2">
          {action.url && (
            <div className="flex items-center gap-2">
              <code className="mono min-w-0 flex-1 truncate rounded-lg border border-line bg-black/40 px-3 py-2 text-[11px] text-cyan/90" title={action.url}>
                {action.url}
              </code>
              <CopyButton value={action.url} label="Путь" className="flex-none text-[11px]" />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <DispatchButton
              text={`[draft-blog] Перенести черновик ${action.url ?? action.title} в блог low-light (draft2blog, после вычитки --vetted)`}
              idleLabel="В блог"
              doneLabel="в очереди"
              Icon={Send}
            />
            <span className="text-[11px] leading-snug text-faint">Перенесём в блог после вашей вычитки</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ------------------------------ История роя ------------------------------ */

/** «2026-07-06T09:36» → «06.07 · 09:36». */
function fmtCreated(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]} · ${m[4]}:${m[5]}` : iso;
}

/** Убирает служебный префикс [tag] из текста задачи для человекочитаемого показа. */
function cleanTaskText(text: string): string {
  return text.replace(/^\s*\[[^\]]*\]\s*/, "").trim() || text;
}

function RoyHistory() {
  const { data } = useApi<TasksResponse>("/api/tasks");
  const [open, setOpen] = useState(false);
  const done = (data?.tasks ?? []).filter((t) => t.status === "done");
  if (done.length === 0) return null;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="focus-ring group flex w-full items-center gap-3 border-t border-line py-4 text-left"
      >
        <ChevronRight
          size={15}
          className={cn("flex-none text-faint transition-transform duration-300", open && "rotate-90 text-iris")}
        />
        <History size={15} className="flex-none text-faint" />
        <SectionLabel>История роя</SectionLabel>
        <span className="mono text-[11px] text-ghost">
          {done.length} {plural(done.length, "задача", "задачи", "задач")} выполнено
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col pb-2 pl-[30px]">
              {done.map((t, i) => (
                <HistoryRow key={t.id} task={t} first={i === 0} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function HistoryRow({ task, first }: { task: SwarmTask; first: boolean }) {
  return (
    <div className={cn("grid grid-cols-[auto_1fr] gap-x-4 py-3.5", !first && "border-t border-line")}>
      <span className="mono tabular pt-0.5 text-[11px] text-ghost">{fmtCreated(task.created)}</span>
      <div className="min-w-0">
        <div className="text-[13px] leading-snug text-muted" title={task.text}>
          {cleanTaskText(task.text)}
        </div>
        {task.result && (
          <div className="mono mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-good/85">
            <Check size={12} strokeWidth={3} className="mt-0.5 flex-none" />
            <span className="min-w-0">{task.result.replace(/^✓\s*/, "")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- Общее -------------------------------- */

function EmptyState({
  Icon,
  title,
  body,
  tone = "neutral",
}: {
  Icon: LucideIcon;
  title: string;
  body: string;
  tone?: "neutral" | "good";
}) {
  return (
    <div className="surface-line flex flex-col items-center gap-4 px-6 py-12 text-center">
      {tone === "good" ? (
        <SeoOrb size={72} tint="good" state="idle" />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-white/[0.02]">
          <Icon size={22} className="text-faint" />
        </div>
      )}
      <div>
        <div className="font-display text-lg font-500 text-ink">{title}</div>
        <p className="mx-auto mt-2 max-w-[340px] text-[13px] leading-relaxed text-faint">{body}</p>
      </div>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-64" />
      </div>
      <div className="grid gap-10 lg:grid-cols-2">
        {[0, 1].map((c) => (
          <div key={c} className="space-y-4">
            <Skeleton className="h-4 w-48" />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
