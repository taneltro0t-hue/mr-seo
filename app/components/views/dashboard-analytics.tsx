"use client";

import { motion } from "framer-motion";
import { Bot, Check, Gauge, Minus, ShieldCheck } from "lucide-react";
import { useApi } from "@/components/use-api";
import { KineticNumber } from "@/components/kinetic-number";
import { Sparkline } from "@/components/sparkline";
import { SectionIntro, SectionLabel, Skeleton, Stagger, StaggerItem } from "@/components/ui";
import { QueryPageCard } from "@/components/views/dashboard-insights";
import type { Analytics, SiteKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const CITY_LABEL: Record<string, string> = { msk: "MSK", vlg: "VLG", spb: "SPB" };

export function DashboardAnalytics({ site, index = 3 }: { site: SiteKey; index?: number }) {
  const { t } = useT();
  const { data, loading } = useApi<Analytics>(`/api/analytics?site=${site}`);

  return (
    <section>
      <SectionIntro index={index} eyebrow={t("analytics.eyebrow")} title={t("analytics.title")} />

      {loading || !data ? (
        <AnalyticsSkeleton />
      ) : (
        <div className="mt-8 space-y-5">
          <NeuroCard data={data} />
          <div className="grid gap-5 lg:grid-cols-2">
            <YandexCard data={data} />
            <SerpCard data={data} />
          </div>
          <QueryPageCard site={site} />
        </div>
      )}
    </section>
  );
}

/* --------------------------- Нейросети про вас --------------------------- */

function NeuroCard({ data }: { data: Analytics }) {
  const { t } = useT();
  const ai = data.ai;
  return (
    <div className="glass p-7">
      <div className="mb-5 flex items-center gap-2.5">
        <Bot size={18} className="text-cyan" />
        <SectionLabel>{t("analytics.llm_title")}</SectionLabel>
        {ai?.week && <span className="mono ml-auto text-[11px] text-faint">{ai.week}</span>}
      </div>

      {!ai ? (
        <EmptyState
          title={t("analytics.llm_empty_t")}
          body={t("analytics.llm_empty_b")}
        />
      ) : (
        <div className="grid gap-7 lg:grid-cols-[220px_1fr]">
          {/* big fraction */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-white/[0.02] py-6">
            <div className="flex items-end gap-1">
              <span className="font-display text-6xl font-600 leading-none text-aurora">
                <KineticNumber value={ai.mentioned} />
              </span>
              <span className="mb-1 font-display text-3xl font-500 text-faint">/{ai.total}</span>
            </div>
            <div className="mt-3 max-w-[180px] text-center text-xs leading-relaxed text-muted">
              {t("analytics.llm_sub")}
            </div>
          </div>

          {/* queries + competitors */}
          <div className="space-y-4">
            <div className="space-y-2">
              {ai.queries.map((q, i) => (
                <motion.div
                  key={q.query}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-3 rounded-xl border border-line bg-white/[0.015] px-3.5 py-2.5"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full",
                      q.mentioned ? "bg-good/15 text-good" : "bg-white/[0.05] text-faint"
                    )}
                  >
                    {q.mentioned ? <Check size={12} strokeWidth={3} /> : <Minus size={12} />}
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-snug text-ink">{q.query}</span>
                  {q.city && CITY_LABEL[q.city] && (
                    <span className="mono flex-none rounded-md border border-line px-1.5 py-0.5 text-[10px] text-faint">
                      {CITY_LABEL[q.city]}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>

            {ai.competitors.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-faint">
                  {t("analytics.llm_rivals")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ai.competitors.map((c) => (
                    <span
                      key={c.domain}
                      className="mono rounded-full border border-line bg-white/[0.02] px-2.5 py-1 text-[11px] text-muted"
                    >
                      {c.domain}
                      <span className="ml-1 text-faint">×{c.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------ Точные метрики Яндекса ------------------------ */

function YandexCard({ data }: { data: Analytics }) {
  const { t } = useT();
  return (
    <div className="surface-line flex h-full flex-col p-7">
      <div className="mb-5 flex items-center gap-2.5">
        <Gauge size={18} className="text-iris" />
        <SectionLabel>{t("analytics.qa_title")}</SectionLabel>
      </div>
      {data.yandex.length === 0 ? (
        <EmptyState
          title={t("analytics.qa_empty_t")}
          body={t("analytics.qa_empty_b")}
        />
      ) : (
        <Stagger className="space-y-2.5" step={0.05}>
          {data.yandex.map((r) => (
            <StaggerItem key={r.q}>
              <div className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.015] px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-500 text-ink" title={r.q}>
                    {r.q}
                  </div>
                  <div className="mono mt-0.5 text-[10px] text-faint">
                    {r.url} · {t("analytics.demand")} {r.demand} · CTR {r.ctr.toFixed(1)}%
                  </div>
                </div>
                <div className="h-8 w-16 flex-none">
                  <Sparkline values={r.series} invert color="#8b93ff" height={32} />
                </div>
                <div className="w-10 flex-none text-right">
                  <div className="mono text-base font-600 leading-none text-ink">
                    {r.position > 0 ? r.position.toFixed(1) : "—"}
                  </div>
                  <div className="text-[9px] text-faint">{t("common.pos_short")}</div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

/* --------------------- Независимая проверка (SERP) --------------------- */

function SerpCard({ data }: { data: Analytics }) {
  const { t } = useT();
  const serp = data.serp;
  return (
    <div className="surface-line flex h-full flex-col p-7">
      <div className="mb-5 flex items-center gap-2.5">
        <ShieldCheck size={18} className="text-good" />
        <SectionLabel>{t("analytics.serp_title")}</SectionLabel>
        {serp?.date && <span className="mono ml-auto text-[11px] text-faint">{serp.date}</span>}
      </div>
      {!serp ? (
        <EmptyState
          title={t("analytics.serp_empty_t")}
          body={t("analytics.serp_empty_b")}
        />
      ) : (
        <>
          <p className="mb-4 text-[11px] leading-relaxed text-faint">
            {t("analytics.serp_sub", { engine: serp.engine })}
          </p>
          <Stagger className="space-y-2.5" step={0.05}>
            {serp.rows.map((r) => {
              const inTop = r.pos != null;
              return (
                <StaggerItem key={r.q}>
                  <div className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.015] px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-500 text-ink" title={r.q}>
                        {r.q}
                      </div>
                      {r.top5[0] && (
                        <div className="mono mt-0.5 truncate text-[10px] text-faint">
                          {t("analytics.serp_top")}: {r.top5[0]}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "mono flex-none rounded-lg border px-2 py-1 text-xs font-600",
                        inTop
                          ? "border-good/25 bg-good/10 text-good"
                          : "border-line bg-white/[0.02] text-faint"
                      )}
                    >
                      {inTop ? `#${r.pos}` : t("analytics.out30")}
                    </span>
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
        </>
      )}
    </div>
  );
}

/* ------------------------------ Shared ------------------------------ */

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-start rounded-2xl border border-dashed border-line bg-white/[0.01] px-5 py-6">
      <div className="text-sm font-600 text-muted">{title}</div>
      <p className="mt-1.5 max-w-[440px] text-xs leading-relaxed text-faint">{body}</p>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-56" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
