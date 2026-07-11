"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, FilePen, Loader2, Star, TriangleAlert, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useApi } from "@/components/use-api";
import { KineticNumber } from "@/components/kinetic-number";
import { Explain } from "@/components/explain";
import { CopyButton, SectionLabel, Skeleton } from "@/components/ui";
import type {
  InsightSrc,
  QueryPageResponse,
  QuickWin,
  QuickWinsResponse,
  ReviewsResponse,
  SiteKey,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/* Источник запроса — тот же цветовой код, что в якорях (Яндекс красный, Google ирис). */
const SRC: Record<InsightSrc, { label: string; full: string; color: string }> = {
  yandex: { label: "Я", full: "Яндекс", color: "#ff6b6b" },
  google: { label: "G", full: "Google", color: "#8b93ff" },
};

const fmtPos = (p: number) => (p > 0 ? p.toFixed(1).replace(/\.0$/, "") : "—");

/* ============================ 1 · БЫСТРЫЕ ПОБЕДЫ ============================ */
/* Editorial-список: увидел → нажал «Поручить рою» → рой чинит. Сердце продукта. */

export function QuickWinsPanel({ site }: { site: SiteKey }) {
  const { data, loading } = useApi<QuickWinsResponse>(`/api/insights?kind=quick_wins&site=${site}`);

  if (loading || !data) return <QuickWinsSkeleton />;
  const wins = data.wins.slice(0, 8);

  if (wins.length === 0) {
    return (
      <InsightEmpty
        title="Быстрых побед пока нет"
        body="Здесь появятся запросы у самой границы топа — те, что можно дожать одним точечным движением. Ближайший скан соберёт их автоматически."
      />
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-baseline gap-3">
        <SectionLabel>На грани топа</SectionLabel>
        <span className="mono text-[11px] text-faint">
          {data.count} {plural(data.count, "запрос", "запроса", "запросов")} · показаны {wins.length}
        </span>
      </div>
      <div className="flex flex-col">
        {wins.map((w, i) => (
          <QuickWinRow key={`${w.src}:${w.query}`} win={w} index={i} site={site} />
        ))}
      </div>
    </div>
  );
}

function QuickWinRow({ win, index, site }: { win: QuickWin; index: number; site: SiteKey }) {
  const src = SRC[win.src];
  const demandStr =
    win.demand != null ? `спрос ${win.demand}` : `${win.impressions} ${plural(win.impressions, "показ", "показа", "показов")}`;
  const pageClause = win.url ? ` — страница ${win.url}` : "";
  const taskText = `[quick-win ${site}] Дожать запрос "${win.query}" (поз ${fmtPos(win.position)}, ${demandStr})${pageClause}: усилить контент/перелинковку, отправить на переобход`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 py-5 sm:grid-cols-[auto_1fr_auto] sm:gap-x-6",
        index > 0 && "border-t border-line"
      )}
    >
      {/* rail: index + источник */}
      <div className="flex items-center gap-3">
        <span className="mono tabular text-[10.5px] text-ghost">{String(index + 1).padStart(2, "0")}</span>
        <span
          className="mono flex h-6 w-6 flex-none items-center justify-center rounded-md text-[11px] font-600"
          style={{ color: src.color, background: `${src.color}14`, border: `1px solid ${src.color}33` }}
          title={src.full}
        >
          {src.label}
        </span>
      </div>

      {/* тело */}
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <div className="truncate text-[15.5px] font-600 leading-tight text-ink sm:text-[17px]" title={win.query}>
          {win.query}
        </div>
        <div className="mono mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-faint">
          <span>
            поз{" "}
            <Explain
              site={site}
              metric={`Позиция «${win.query}»`}
              value={fmtPos(win.position)}
              context={`источник ${src.full}, ${demandStr}; запрос у границы топа`}
            >
              <span className="tabular text-muted">{fmtPos(win.position)}</span>
            </Explain>
          </span>
          <span className="text-ghost">·</span>
          <span>{demandStr}</span>
          {win.url && (
            <>
              <span className="text-ghost">·</span>
              <span className="truncate text-iris/75">{win.url}</span>
            </>
          )}
        </div>
      </div>

      {/* dispatch — поручить рою (быстро) + написать статью (долго) */}
      <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:justify-self-end">
        <DispatchButton text={taskText} />
        <ForgeButton site={site} query={win.query} url={win.url} />
      </div>
    </motion.div>
  );
}

type DispatchState = "idle" | "sending" | "done" | "error";

/**
 * Единая кнопка «поручить рою»: POST /api/tasks {text}. Метки/иконка
 * параметризуются, чтобы переиспользовать её для фокуса недели («Поручить»)
 * и переноса черновика («В блог») — один паттерн состояния на весь продукт.
 */
export function DispatchButton({
  text,
  idleLabel = "Поручить рою",
  doneLabel = "в очереди роя",
  Icon = Zap,
}: {
  text: string;
  idleLabel?: string;
  doneLabel?: string;
  Icon?: LucideIcon;
}) {
  const [state, setState] = useState<DispatchState>("idle");

  const dispatch = async () => {
    if (state === "sending" || state === "done") return;
    setState("sending");
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setState(r.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <motion.span
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mono inline-flex items-center gap-1.5 rounded-lg border border-good/30 bg-good/10 px-3 py-2 text-[12px] font-600 text-good"
      >
        <Check size={13} strokeWidth={3} /> {doneLabel}
      </motion.span>
    );
  }

  return (
    <button
      type="button"
      onClick={dispatch}
      disabled={state === "sending"}
      className={cn(
        "focus-ring inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-600 transition-colors",
        state === "error"
          ? "border-warn/40 bg-warn/10 text-warn hover:bg-warn/[0.16]"
          : "border-line bg-white/[0.03] text-muted hover:border-iris/45 hover:bg-iris/10 hover:text-iris"
      )}
    >
      {state === "sending" ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <Icon size={13} className={state === "error" ? "" : "text-iris"} />
      )}
      {state === "sending" ? "Отправляю…" : state === "error" ? "Ещё раз" : idleLabel}
    </button>
  );
}

/* ---- Контент-станок: запрос → черновик статьи (долгая операция 2-4 мин) ---- */

type ForgeState = "idle" | "writing" | "done" | "error";

export function ForgeButton({
  site,
  query,
  url,
}: {
  site: string;
  query: string;
  url?: string | null;
}) {
  const [state, setState] = useState<ForgeState>("idle");
  const [draft, setDraft] = useState<{ path: string; chars: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  // тикающий таймер, пока «мозг пишет» — ощущение живого прогресса
  useEffect(() => {
    if (state !== "writing") return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [state]);

  const forge = async () => {
    if (state === "writing" || state === "done") return;
    startedAt.current = Date.now();
    setElapsed(0);
    setState("writing");
    setDraft(null);
    try {
      const r = await fetch("/api/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site, query, url: url ?? undefined }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok && j?.draft_path) {
        setDraft({ path: String(j.draft_path), chars: Number(j.chars ?? 0) });
        setState("done");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  };

  if (state === "writing") {
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    return (
      <motion.span
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="mono inline-flex items-center gap-2 rounded-lg border border-cyan/30 bg-cyan/[0.08] px-3 py-2 text-[12px] font-600 text-cyan"
      >
        {/* дышащий орб-точка — мозг думает */}
        <motion.span
          className="h-2 w-2 flex-none rounded-full bg-cyan"
          animate={{ opacity: [1, 0.3, 1], scale: [1, 0.7, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ boxShadow: "0 0 10px rgba(56,232,208,0.8)" }}
        />
        Мозг пишет…
        <span className="tabular text-cyan/70">{mm}:{ss}</span>
        <span className="hidden text-cyan/50 sm:inline">· ~2–4 мин</span>
      </motion.span>
    );
  }

  if (state === "done" && draft) {
    return (
      <motion.span
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="inline-flex flex-wrap items-center gap-2"
      >
        <span className="mono inline-flex items-center gap-1.5 rounded-lg border border-good/30 bg-good/10 px-3 py-2 text-[12px] font-600 text-good">
          <Check size={13} strokeWidth={3} /> Черновик готов
          {draft.chars > 0 && <span className="text-good/60">· {Math.round(draft.chars / 1000)}к зн.</span>}
        </span>
        <CopyButton value={draft.path} label="Путь" className="text-[11px]" />
      </motion.span>
    );
  }

  return (
    <button
      type="button"
      onClick={forge}
      className={cn(
        "focus-ring inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-600 transition-colors",
        state === "error"
          ? "border-warn/40 bg-warn/10 text-warn hover:bg-warn/[0.16]"
          : "border-line bg-white/[0.03] text-muted hover:border-cyan/45 hover:bg-cyan/10 hover:text-cyan"
      )}
    >
      <FilePen size={13} className={state === "error" ? "" : "text-cyan"} />
      {state === "error" ? "Ещё раз" : "Статья"}
    </button>
  );
}

function QuickWinsSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="mb-4 h-4 w-48" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={cn("grid grid-cols-[auto_1fr_auto] items-center gap-x-6 py-5", i > 0 && "border-t border-line")}>
          <Skeleton className="h-6 w-14 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/* ============================== 2 · ОТЗЫВЫ ============================== */
/* По точкам текущего сайта: рейтинг, отзывы, +N за 7д, Читать / Ответить. */

export function ReviewsPanel({ site }: { site: SiteKey }) {
  const { data, loading } = useApi<ReviewsResponse>(`/api/insights?kind=reviews`);

  return (
    <div>
      <SectionLabel className="mb-4">Репутация · Я.Карты</SectionLabel>
      {loading || !data ? (
        <div className="grid gap-px overflow-hidden rounded-[var(--radius-xl2)] border border-line bg-line">
          <Skeleton className="h-40" />
        </div>
      ) : (
        <ReviewsBody data={data} site={site} />
      )}
    </div>
  );
}

function ReviewsBody({ data, site }: { data: ReviewsResponse; site: SiteKey }) {
  const points = data.points.filter((p) => p.key === site || p.key.startsWith(`${site}_`));

  if (points.length === 0) {
    return (
      <InsightEmpty
        title="У этого проекта нет точек на Я.Картах"
        body="Мониторить отзывы можно только по карточкам организации на Яндекс.Картах. Как только точка появится и подключится — рейтинг и свежие отзывы придут сюда."
      />
    );
  }

  return (
    <div>
      <div className="grid gap-px overflow-hidden rounded-[var(--radius-xl2)] border border-line bg-line">
        {points.map((p, i) => (
          <ReviewCard key={p.key} point={p} index={i} site={site} />
        ))}
      </div>
      {data.note && <p className="mt-3 text-[11px] leading-relaxed text-faint">{data.note}</p>}
    </div>
  );
}

function ReviewCard({ point, index, site }: { point: ReviewsResponse["points"][number]; index: number; site: SiteKey }) {
  const fresh = point.new_7d > 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="bg-base p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="cap">{point.label}</div>
        {fresh ? (
          <span className="mono inline-flex items-center gap-1.5 rounded-full border border-good/30 bg-good/10 px-2.5 py-1 text-[10px] font-600 text-good">
            <span className="warm-pulse h-1.5 w-1.5 rounded-full bg-good" />
            есть новые!
          </span>
        ) : (
          <span className="mono rounded-full border border-line px-2.5 py-1 text-[10px] text-faint">без новых</span>
        )}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <span className="tabular font-display text-4xl font-600 leading-none text-ink">
          <Explain
            site={site}
            metric={`Рейтинг · ${point.label}`}
            value={point.rating.toFixed(1)}
            context={`${point.reviews} отзывов на Яндекс.Картах; шкала 1–5★`}
          >
            <KineticNumber value={point.rating} decimals={1} />
          </Explain>
        </span>
        <Star size={16} className="mb-1 fill-ok text-ok" />
        <span className="mono mb-1 ml-1 text-[11px] text-faint">
          {point.reviews} {plural(point.reviews, "отзыв", "отзыва", "отзывов")}
        </span>
      </div>

      {fresh && (
        <div className="mono mt-2 text-[11px] font-600 text-good">
          +{point.new_7d} {plural(point.new_7d, "новый", "новых", "новых")} за 7 дней — ответьте им
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <a
          href={point.read_url}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-3 py-2 text-[12px] font-600 text-muted transition-colors hover:bg-white/[0.07] hover:text-ink"
        >
          Читать
        </a>
        <a
          href={point.reply_url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-600 transition-colors",
            fresh
              ? "bg-iris text-base-2 hover:opacity-90"
              : "border border-line bg-white/[0.03] text-muted hover:border-iris/45 hover:text-iris"
          )}
        >
          Ответить
        </a>
      </div>
    </motion.div>
  );
}

/* ========================= 3 · ЗАПРОС ↔ СТРАНИЦА ========================= */
/* Раскрывашка: топ-8 страниц, у каждой — её запросы. «Кто за что отвечает». */

export function QueryPageCard({ site }: { site: SiteKey }) {
  const { data, loading } = useApi<QueryPageResponse>(`/api/insights?kind=query_page&site=${site}`);

  return (
    <div className="surface-line p-7">
      <div className="mb-1.5 flex items-center gap-2.5">
        <ChevronRight size={17} className="text-cyan" />
        <SectionLabel>Запрос ↔ страница</SectionLabel>
      </div>
      <p className="mb-4 text-[11px] leading-relaxed text-faint">
        Какая страница за какие запросы отвечает. Разверните страницу — увидите её запросы и позиции.
      </p>

      {loading || !data ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : data.pages.length === 0 ? (
        <InsightEmpty
          title="Связка запрос ↔ страница ещё не собрана"
          body="Как только Вебмастер отдаст статистику по URL, здесь появится карта: какая страница за что отвечает."
        />
      ) : (
        <div className="flex flex-col">
          {data.pages.slice(0, 8).map((p, i) => (
            <PageRow key={p.page} page={p} defaultOpen={i === 0} first={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function PageRow({
  page,
  defaultOpen,
  first,
}: {
  page: QueryPageResponse["pages"][number];
  defaultOpen: boolean;
  first: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const queries = [...page.queries].sort((a, b) => {
    const pa = a.position > 0 ? a.position : 999;
    const pb = b.position > 0 ? b.position : 999;
    return pa - pb;
  });

  return (
    <div className={cn(!first && "border-t border-line")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="focus-ring group flex w-full items-center gap-3 py-3.5 text-left"
      >
        <ChevronRight
          size={14}
          className={cn("flex-none text-faint transition-transform duration-300", open && "rotate-90 text-iris")}
        />
        <span className="mono min-w-0 flex-1 truncate text-[13px] text-ink group-hover:text-white" title={page.page}>
          {page.page}
        </span>
        <span className="cap flex-none">
          {page.total_queries} {plural(page.total_queries, "запрос", "запроса", "запросов")}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 pb-4 pl-7">
              {queries.map((q) => {
                const src = SRC[q.src];
                const inIndex = q.position > 0;
                return (
                  <div
                    key={`${q.src}:${q.query}`}
                    className="flex items-center gap-3 rounded-lg border border-line bg-white/[0.015] px-3 py-2"
                  >
                    <span
                      className="mono flex h-5 w-5 flex-none items-center justify-center rounded text-[10px] font-600"
                      style={{ color: src.color, background: `${src.color}14` }}
                      title={src.full}
                    >
                      {src.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted" title={q.query}>
                      {q.query}
                    </span>
                    <span
                      className={cn(
                        "mono tabular flex-none rounded-md border px-2 py-0.5 text-[11px] font-600",
                        inIndex ? "border-line text-ink" : "border-line bg-white/[0.02] text-faint"
                      )}
                    >
                      {inIndex ? fmtPos(q.position) : "вне топа"}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================================ SHARED ================================ */

function InsightEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-dashed border-line bg-white/[0.01] px-5 py-6">
      <TriangleAlert size={16} className="mt-0.5 flex-none text-faint" />
      <div>
        <div className="text-sm font-600 text-muted">{title}</div>
        <p className="mt-1.5 max-w-[440px] text-xs leading-relaxed text-faint">{body}</p>
      </div>
    </div>
  );
}

/** Русская плюрализация: (1 → one, 2..4 → few, 0/5.. → many). */
export function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
