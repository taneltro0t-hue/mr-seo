"use client";

import { motion } from "framer-motion";
import { ArrowDown, FileX2, Link2, Radar, ShieldCheck, Split, TrendingDown } from "lucide-react";
import { useApi } from "@/components/use-api";
import { KineticNumber } from "@/components/kinetic-number";
import { Explain } from "@/components/explain";
import { Sparkline } from "@/components/sparkline";
import { SectionIntro, SectionLabel, Skeleton } from "@/components/ui";
import { DispatchButton } from "@/components/views/dashboard-insights";
import { useT } from "@/lib/i18n";
import type {
  CannibalizationResponse,
  DecayResponse,
  ExcludedResponse,
  LinksResponse,
  SiteKey,
  SqiResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/* ============================ helpers ============================ */

/** Короткий путь URL без origin — /moscow/korporativnaya-pesnya. */
function shortPath(url: string): string {
  try {
    const u = new URL(url);
    const p = (u.pathname + u.search).replace(/\/$/, "");
    return p === "" ? "/" : p;
  } catch {
    return url.replace(/^https?:\/\/[^/]+/, "") || url;
  }
}

/** Домен источника без www. */
function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** 2026-07-05 → 05.07. */
function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}` : iso;
}

/* Тон причины выпадения: МПК красный, 404 янтарный, редирект/дубль нейтральный. */
type ReasonTone = "warn" | "ok" | "neutral";
function reasonTone(code: string): ReasonTone {
  if (code === "LOW_QUALITY") return "warn";
  if (code === "NOTHING_FOUND") return "ok";
  return "neutral";
}
const REASON_STYLE: Record<ReasonTone, string> = {
  warn: "border-warn/30 bg-warn/10 text-warn",
  ok: "border-ok/30 bg-ok/10 text-ok",
  neutral: "border-line bg-white/[0.03] text-faint",
};

const ROW_IN = {
  initial: { opacity: 0, y: 14, filter: "blur(6px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, amount: 0.25 } as const,
};

/* ============================ section ============================ */

export function DashboardDiagnosis({ site, index }: { site: SiteKey; index: number }) {
  const { t } = useT();
  return (
    <section>
      <SectionIntro
        index={index}
        eyebrow={t("diag.eyebrow")}
        title={t("diag.title")}
        note={t("diag.note")}
      />
      <div className="mt-8 space-y-5">
        <ExcludedPanel site={site} />
        <div className="grid gap-5 lg:grid-cols-2">
          <CannibalPanel site={site} />
          <DecayPanel site={site} />
        </div>
      </div>
    </section>
  );
}

/* ---------------------- A · Выпавшие из поиска ---------------------- */

function ExcludedPanel({ site }: { site: SiteKey }) {
  const { t } = useT();
  const { data, loading } = useApi<ExcludedResponse>(`/api/webmaster?kind=excluded&site=${site}`);

  return (
    <div className="surface-line p-7">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FileX2 size={18} className="text-warn" />
        <SectionLabel>{t("diag.excluded_title")}</SectionLabel>
        {data && (
          <div className="mono ml-auto flex items-center gap-2.5 text-[11px]">
            <span className="rounded-md border border-warn/25 bg-warn/10 px-2 py-1 text-warn">
              {t("diag.removed")} <span className="tabular font-600">{data.removed_count}</span>
            </span>
            <span className="rounded-md border border-good/25 bg-good/10 px-2 py-1 text-good">
              {t("diag.appeared")} <span className="tabular font-600">{data.appeared_count}</span>
            </span>
          </div>
        )}
      </div>

      {loading || !data ? (
        <div className="mt-5 space-y-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : data.removed_count === 0 ? (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-good/25 bg-good/[0.06] px-5 py-6">
          <ShieldCheck size={18} className="flex-none text-good" />
          <div>
            <div className="text-sm font-600 text-good">{t("diag.excl_ok_title")}</div>
            <p className="mt-1 text-xs leading-relaxed text-faint">
              {t("diag.excl_ok_body")}
            </p>
          </div>
        </div>
      ) : (
        <ExcludedList data={data} />
      )}
    </div>
  );
}

function ExcludedList({ data }: { data: ExcludedResponse }) {
  const { t } = useT();
  const rows = data.removed.slice(0, 12);
  return (
    <div className="mt-5">
      <div className="flex flex-col">
        {rows.map((r, i) => {
          const tone = reasonTone(r.reason);
          return (
            <motion.div
              key={`${r.url}:${r.date}:${i}`}
              {...ROW_IN}
              transition={{ duration: 0.5, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 py-3.5",
                i > 0 && "border-t border-line"
              )}
            >
              <div className="min-w-0">
                <div className="mono truncate text-[12.5px] text-ink" title={r.url}>
                  {shortPath(r.url)}
                </div>
                <div className="mono mt-1 text-[10px] text-ghost">{t("diag.dropped_on", { date: shortDate(r.date) })}</div>
              </div>
              <span
                className={cn(
                  "cap flex-none rounded-md border px-2 py-1",
                  REASON_STYLE[tone]
                )}
              >
                {r.reason_ru}
              </span>
            </motion.div>
          );
        })}
      </div>
      {data.removed_count > rows.length && (
        <div className="mono mt-3 text-[11px] text-faint">
          {t("diag.shown_of", { n: rows.length, total: data.removed_count })}
        </div>
      )}
      {data.note && <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-faint">{data.note}</p>}
    </div>
  );
}

/* ------------------------- B · Каннибализация ------------------------- */

function CannibalPanel({ site }: { site: SiteKey }) {
  const { t, tn } = useT();
  const { data, loading } = useApi<CannibalizationResponse>(
    `/api/insights?kind=cannibalization&site=${site}`
  );

  return (
    <div className="surface-line flex h-full flex-col p-7">
      <div className="mb-5 flex items-center gap-2.5">
        <Split size={18} className="text-iris" />
        <SectionLabel>{t("diag.cannibal_title")}</SectionLabel>
        {data && data.count > 0 && (
          <span className="mono ml-auto text-[11px] text-faint">
            {data.count} {tn("conflict", data.count)}
          </span>
        )}
      </div>

      {loading || !data ? (
        <div className="space-y-2.5">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : data.count === 0 ? (
        <DiagnosisEmpty
          good
          title={t("diag.cannibal_empty_title")}
          body={t("diag.cannibal_empty_body")}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {data.conflicts.map((c, i) => {
            const [p1, p2] = c.pages;
            const taskText = `[cannibal ${site}] Запрос "${c.query}": страницы ${
              p1 ? shortPath(p1.page) : "?"
            } и ${p2 ? shortPath(p2.page) : "?"} конкурируют — выбрать главную, слить сигналы`;
            return (
              <motion.div
                key={c.query}
                {...ROW_IN}
                transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl border border-line bg-white/[0.015] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-[15px] font-600 leading-tight text-ink" title={c.query}>
                    {c.query}
                  </div>
                  <span className="mono flex-none text-[10px] text-ghost">
                    {c.total_impressions} {tn("impression", c.total_impressions)}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5">
                  {c.pages.map((p) => (
                    <div key={p.page} className="flex items-center gap-3">
                      <span className="mono min-w-0 flex-1 truncate text-[12px] text-muted" title={p.page}>
                        {shortPath(p.page)}
                      </span>
                      <span className="mono flex-none text-[10px] text-ghost">
                        {t("diag.imp_abbr", { n: p.impressions })}
                      </span>
                      <span className="mono tabular flex-none rounded-md border border-line px-2 py-0.5 text-[11px] font-600 text-ink">
                        {p.position.toFixed(1).replace(/\.0$/, "")}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex justify-end">
                  <DispatchButton text={taskText} />
                </div>
              </motion.div>
            );
          })}
          {data.note && <p className="text-[11px] leading-relaxed text-faint">{data.note}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------------------------- C · Угасание ---------------------------- */

function DecayPanel({ site }: { site: SiteKey }) {
  const { t, tn } = useT();
  const { data, loading } = useApi<DecayResponse>(`/api/insights?kind=decay&site=${site}`);

  return (
    <div className="surface-line flex h-full flex-col p-7">
      <div className="mb-5 flex items-center gap-2.5">
        <TrendingDown size={18} className="text-warn" />
        <SectionLabel>{t("diag.decay_title")}</SectionLabel>
        {data && data.count > 0 && (
          <span className="mono ml-auto text-[11px] text-faint">
            {data.count} {tn("query", data.count)}
          </span>
        )}
      </div>

      {loading || !data ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : data.count === 0 ? (
        <DiagnosisEmpty
          good
          title={t("diag.decay_empty_title")}
          body={t("diag.decay_empty_body")}
        />
      ) : (
        <div className="flex flex-col">
          {data.losing.map((r, i) => {
            const taskText = `[decay ${site}] Запрос "${r.query}" теряет позиции ${r.was
              .toFixed(1)
              .replace(/\.0$/, "")}→${r.now
              .toFixed(1)
              .replace(/\.0$/, "")}: освежить страницу и на переобход`;
            return (
              <motion.div
                key={r.query}
                {...ROW_IN}
                transition={{ duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2.5 py-4",
                  i > 0 && "border-t border-line"
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-600 leading-tight text-ink" title={r.query}>
                    {r.query}
                  </div>
                  <div className="mono mt-1.5 flex items-center gap-2 text-[11px]">
                    <span className="tabular text-faint">{r.was.toFixed(1).replace(/\.0$/, "")}</span>
                    <ArrowDown size={12} className="text-warn" strokeWidth={2.5} />
                    <span className="tabular font-600 text-warn">
                      {r.now.toFixed(1).replace(/\.0$/, "")}
                    </span>
                    <span className="text-ghost">·</span>
                    <span className="text-faint">
                      {r.impressions} {tn("impression", r.impressions)}
                    </span>
                  </div>
                </div>
                <div className="flex-none justify-self-end">
                  <DispatchButton text={taskText} />
                </div>
              </motion.div>
            );
          })}
          {data.note && <p className="mt-3 text-[11px] leading-relaxed text-faint">{data.note}</p>}
        </div>
      )}
    </div>
  );
}

/* ==================== приборы: ИКС + Ссылки ==================== */
/* Живут в секции «Данные и репутация» — та же строка приборов. */

export function DiagnosticInstruments({ site }: { site: SiteKey }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <SqiInstrument site={site} />
      <LinksInstrument site={site} />
    </div>
  );
}

function SqiInstrument({ site }: { site: SiteKey }) {
  const { t } = useT();
  const { data, loading } = useApi<SqiResponse>(`/api/webmaster?kind=sqi&site=${site}`);

  if (loading || !data) {
    return (
      <div className="surface-line p-6">
        <Skeleton className="mb-4 h-4 w-24" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (data.current == null) {
    return (
      <div className="surface-line p-6">
        <div className="mb-3 flex items-center gap-2.5">
          <Radar size={16} className="text-cyan" />
          <SectionLabel>{t("diag.sqi_short")}</SectionLabel>
        </div>
        <DiagnosisEmpty
          title={t("diag.sqi_empty_title")}
          body={t("diag.sqi_empty_body")}
        />
      </div>
    );
  }

  const d = data.delta_period;
  const deltaTone = d > 0 ? "text-good" : d < 0 ? "text-warn" : "text-faint";
  const deltaStr = d > 0 ? `+${d}` : d < 0 ? String(d) : "±0";

  return (
    <div className="surface-line p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <Radar size={16} className="text-cyan" />
        <SectionLabel>{t("diag.sqi_title")}</SectionLabel>
      </div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-end gap-2.5">
            <span className="mono tabular font-display text-5xl font-600 leading-none text-ink">
              <Explain
                site={site}
                metric={t("diag.sqi_metric")}
                value={data.current}
                context={t("diag.sqi_ctx", { delta: deltaStr })}
              >
                <KineticNumber value={data.current} />
              </Explain>
            </span>
            <span className={cn("mono tabular mb-1 text-[13px] font-600", deltaTone)}>{deltaStr}</span>
          </div>
          <div className="cap mt-2.5">{t("diag.sqi_caption")}</div>
        </div>
        <div className="h-12 w-28 flex-none">
          <Sparkline values={data.history.map((p) => p.value)} color="#38e8d0" height={48} />
        </div>
      </div>
    </div>
  );
}

function LinksInstrument({ site }: { site: SiteKey }) {
  const { t, tn } = useT();
  const { data, loading } = useApi<LinksResponse>(`/api/webmaster?kind=links&site=${site}`);

  if (loading || !data) {
    return (
      <div className="surface-line p-6">
        <Skeleton className="mb-4 h-4 w-24" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  const total = data.total_history.length > 0 ? data.total_history[data.total_history.length - 1].total : null;

  if (total == null) {
    return (
      <div className="surface-line p-6">
        <div className="mb-3 flex items-center gap-2.5">
          <Link2 size={16} className="text-iris" />
          <SectionLabel>{t("diag.links_short")}</SectionLabel>
        </div>
        <DiagnosisEmpty
          title={t("diag.links_empty_title")}
          body={t("diag.links_empty_body")}
        />
      </div>
    );
  }

  const donors = data.fresh_donors.slice(0, 3);

  return (
    <div className="surface-line p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <Link2 size={16} className="text-iris" />
        <SectionLabel>{t("diag.links_title")}</SectionLabel>
      </div>
      <div className="flex items-end gap-2.5">
        <span className="mono tabular font-display text-5xl font-600 leading-none text-ink">
          <KineticNumber value={total} />
        </span>
        <span className="cap mb-1.5">
          {tn("donor", total)}
        </span>
      </div>

      {donors.length > 0 && (
        <div className="mt-5 flex flex-col border-t border-line">
          {donors.map((donor, i) => (
            <div
              key={`${donor.source}:${i}`}
              className={cn("flex items-center gap-3 py-2.5", i > 0 && "border-t border-line")}
            >
              <span className="h-1.5 w-1.5 flex-none rounded-full bg-iris/60" />
              <span className="mono min-w-0 flex-1 truncate text-[12px] text-muted" title={donor.source}>
                {host(donor.source)}
              </span>
              <span className="mono flex-none text-[10px] text-ghost">{shortDate(donor.discovered)}</span>
            </div>
          ))}
        </div>
      )}
      {data.note && <p className="mt-3 text-[11px] leading-relaxed text-faint">{data.note}</p>}
    </div>
  );
}

/* ============================ shared ============================ */

function DiagnosisEmpty({ title, body, good = false }: { title: string; body: string; good?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-1 items-start gap-3 rounded-2xl border border-dashed px-5 py-6",
        good ? "border-good/25 bg-good/[0.04]" : "border-line bg-white/[0.01]"
      )}
    >
      {good && <ShieldCheck size={16} className="mt-0.5 flex-none text-good" />}
      <div>
        <div className={cn("text-sm font-600", good ? "text-good" : "text-muted")}>{title}</div>
        <p className="mt-1.5 max-w-[440px] text-xs leading-relaxed text-faint">{body}</p>
      </div>
    </div>
  );
}
