"use client";

import { ArrowRight, Minus, Printer, Star, TrendingDown, TrendingUp } from "lucide-react";
import { useSite } from "@/components/providers";
import { useApi } from "@/components/use-api";
import { useT } from "@/lib/i18n";
import { SeoOrb } from "@/components/seo-orb";
import { IndexTag, SectionLabel } from "@/components/ui";
import { REPUTATION_MAP, SITES } from "@/lib/sites";
import type { ReportResponse } from "@/lib/types";
import { cn, splitQueryTag } from "@/lib/utils";

const fmt = (n: number) => n.toFixed(1).replace(/\.0$/, "");

export function ReportView() {
  const { t } = useT();
  const { site } = useSite();
  const { data, loading, error } = useApi<ReportResponse>(`/api/report?site=${site}&days=30`);
  const meta = SITES[site];

  if (loading) return <ReportLoading label={meta.label} />;
  if (error || !data) return <ReportError />;

  return (
    <div>
      {/* панель действий — не печатается */}
      <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <IndexTag n="R" />
          <SectionLabel>{t("report.eyebrow")}</SectionLabel>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-4 py-2.5 text-[13px] font-600 text-ink transition-colors hover:border-iris/45 hover:bg-iris/10 hover:text-iris"
        >
          <Printer size={15} /> {t("report.print")}
        </button>
      </div>

      {/* сам лист отчёта */}
      <article className="report-sheet mx-auto max-w-[820px]">
        <ReportHead data={data} label={meta.label} domain={meta.domain} />
        <VitalsRow data={data} />
        <AnchorsBlock data={data} />
        <ReputationBlock data={data} site={site} />
        <WorksBlock data={data} />
        <footer className="mt-12 flex items-center justify-between border-t border-line pt-5">
          <span className="cap text-faint">{t("report.footer_auto")}</span>
          <span className="mono text-[11px] text-faint">{meta.domain}</span>
        </footer>
      </article>
    </div>
  );
}

/* -------------------------------- Шапка -------------------------------- */

function ReportHead({ data, label, domain }: { data: ReportResponse; label: string; domain: string }) {
  const { t } = useT();
  const positive = data.verdict.match(/раст|улучш|двиг|рост|вырос/i) != null;
  const negative = data.verdict.match(/паден|проседа|упал|снизил|хуже/i) != null;
  const vColor = positive ? "#4bd39a" : negative ? "#ff6b6b" : "#8b93ff";
  return (
    <header className="border-b border-line pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="cap">{t("report.head_days", { days: data.period_days })}</div>
          <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-500 leading-[0.98] tracking-[-0.035em] text-ink">
            {label}
          </h1>
          <div className="mono mt-2 text-[12px] text-faint">{domain}</div>
        </div>
        <div className="text-right">
          <div className="cap">{t("report.generated")}</div>
          <div className="mono mt-2 text-[13px] font-600 text-muted">{data.generated}</div>
        </div>
      </div>

      {/* вердикт крупно */}
      <div
        className="mt-8 rounded-2xl border px-6 py-5"
        style={{ borderColor: `${vColor}44`, background: `${vColor}0f` }}
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: vColor }} />
          <span className="cap" style={{ color: vColor }}>{t("report.verdict")}</span>
        </div>
        <p className="mt-3 font-display text-[clamp(1.3rem,2.6vw,1.9rem)] font-500 leading-tight tracking-[-0.02em] text-ink">
          {data.verdict}
        </p>
      </div>
    </header>
  );
}

/* ------------------------------ Витальные показатели ------------------------------ */

function VitalsRow({ data }: { data: ReportResponse }) {
  const { t } = useT();
  const yandex = data.clicks?.now?.yandex;
  const google = data.clicks?.now?.google;
  const sqi = data.sqi;

  return (
    <section className="mt-10 grid gap-4 sm:grid-cols-3">
      <Vital
        label={t("report.vital_sqi")}
        value={sqi?.current != null ? String(sqi.current) : "—"}
        delta={sqi?.delta ?? null}
        deltaSuffix=""
        hint={t("report.vital_sqi_hint")}
      />
      <Vital
        label={t("report.vital_yandex")}
        value={yandex ? String(yandex.клики7д) : "—"}
        sub={yandex ? t("report.in_top10", { n: yandex.топ10 }) : undefined}
        hint={t("report.vital_clicks_hint")}
      />
      <Vital
        label={t("report.vital_google")}
        value={google ? String(google.клики7д) : "—"}
        sub={google ? t("report.in_top10", { n: google.топ10 }) : undefined}
        hint={t("report.vital_clicks_hint")}
      />
    </section>
  );
}

function Vital({
  label,
  value,
  sub,
  delta = null,
  deltaSuffix = "",
  hint,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  deltaSuffix?: string;
  hint?: string;
}) {
  const up = delta != null && delta > 0;
  return (
    <div className="surface-line p-5">
      <div className="cap">{label}</div>
      <div className="mt-3 flex items-end gap-2.5">
        <span className="mono tabular font-display text-[2.4rem] font-600 leading-none text-ink">{value}</span>
        {delta != null && delta !== 0 && (
          <span className={cn("mono mb-1 inline-flex items-center gap-0.5 text-[13px] font-600", up ? "text-good" : "text-warn")}>
            {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {up ? "+" : ""}
            {delta}
            {deltaSuffix}
          </span>
        )}
      </div>
      {sub && <div className="mt-2 text-[12px] text-muted">{sub}</div>}
      {hint && <div className="mono mt-1 text-[10.5px] text-faint">{hint}</div>}
    </div>
  );
}

/* -------------------------------- Якоря -------------------------------- */

function AnchorsBlock({ data }: { data: ReportResponse }) {
  const { t } = useT();
  if (!data.anchors?.length) return null;
  return (
    <section className="mt-12">
      <SectionLabel className="mb-4">{t("report.anchors_title")}</SectionLabel>
      <div className="overflow-hidden rounded-2xl border border-line">
        {data.anchors.map((a, i) => {
          const { query, engine } = splitQueryTag(a.query);
          const improved = a.delta > 0.05;
          const worse = a.delta < -0.05;
          const col = improved ? "#4bd39a" : worse ? "#ff6b6b" : "rgba(255,255,255,0.42)";
          return (
            <div
              key={a.query}
              className={cn(
                "grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4",
                i > 0 && "border-t border-line"
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-[15px] font-600 text-ink" title={query}>{query}</div>
                {engine && (
                  <div className="cap mt-1" style={{ color: engine === "yandex" ? "#ff6b6b" : "#8b93ff" }}>
                    {engine === "yandex" ? t("report.eng_yandex") : "Google"}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="mono tabular text-[15px] text-faint">{fmt(a.was)}</span>
                <ArrowRight size={14} className="text-ghost" />
                <span className="mono tabular text-[18px] font-600 text-ink">{fmt(a.now)}</span>
                <span className="mono inline-flex w-[52px] items-center justify-end gap-0.5 text-[13px] font-600" style={{ color: col }}>
                  {improved ? <TrendingUp size={14} /> : worse ? <TrendingDown size={14} /> : <Minus size={13} />}
                  {a.delta !== 0 ? Math.abs(a.delta).toFixed(1).replace(/\.0$/, "") : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mono mt-2 text-[10.5px] text-faint">{t("report.pos_hint")}</p>
    </section>
  );
}

/* ------------------------------ Репутация ------------------------------ */

function ReputationBlock({ data, site }: { data: ReportResponse; site: keyof typeof SITES }) {
  const { t, tn } = useT();
  const entries = Object.entries(data.reputation ?? {});
  if (entries.length === 0) return null;
  const labelMap = new Map((REPUTATION_MAP[site] ?? []).map((r) => [r.key, r.label]));
  return (
    <section className="mt-12">
      <SectionLabel className="mb-4">{t("report.rep_title")}</SectionLabel>
      <div className="grid gap-4 sm:grid-cols-2">
        {entries.map(([key, p]) => (
          <div key={key} className="surface-line flex items-center justify-between gap-4 p-5">
            <div>
              <div className="cap">{labelMap.get(key) ?? key}</div>
              <div className="mt-2 flex items-end gap-1.5">
                <span className="mono tabular font-display text-[2rem] font-600 leading-none text-ink">{p.rating.toFixed(1)}</span>
                <Star size={16} className="mb-1 fill-ok text-ok" />
              </div>
            </div>
            <div className="text-right">
              <div className="mono tabular text-[15px] font-600 text-ink">{p.reviews}</div>
              <div className="cap mt-1">{tn("review", p.reviews)}</div>
              {p.new > 0 && <div className="mono mt-1.5 text-[11px] font-600 text-good">+{p.new} {tn("new", p.new)}</div>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------- Работы -------------------------------- */

const WORK_TONE: Record<string, string> = {
  commit: "#8b93ff",
  bridge: "#38e8d0",
  hypothesis: "#f4c25a",
  verdict: "#4bd39a",
};

function WorksBlock({ data }: { data: ReportResponse }) {
  const { t } = useT();
  if (!data.works?.length) return null;
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-baseline gap-3">
        <SectionLabel>{t("report.works_title")}</SectionLabel>
        <span className="mono text-[11px] text-faint">{t("report.works_total", { n: data.works_total })}</span>
      </div>
      <div className="flex flex-col">
        {data.works.map((w, i) => (
          <div
            key={i}
            className={cn("grid grid-cols-[auto_1fr] items-start gap-x-4 py-3", i > 0 && "border-t border-line")}
          >
            <div className="flex items-center gap-3 pt-0.5">
              <span className="mono tabular text-[11px] text-faint">{w.date}</span>
              <span
                className="h-1.5 w-1.5 flex-none rounded-full"
                style={{ background: w.type ? WORK_TONE[w.type] ?? "#8b93ff" : "#8b93ff" }}
              />
            </div>
            <div className="text-[13.5px] leading-snug text-muted">{w.title}</div>
          </div>
        ))}
      </div>
      {data.works_total > data.works.length && (
        <p className="mono mt-3 text-[11px] text-faint">
          {t("report.works_more", { more: data.works_total - data.works.length, shown: data.works.length })}
        </p>
      )}
    </section>
  );
}

/* ------------------------------ Состояния ------------------------------ */

function ReportLoading({ label }: { label: string }) {
  const { t } = useT();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <SeoOrb size={96} state="thinking" tint="neutral" hero interactive />
      <div>
        <div className="font-display text-xl font-500 text-ink">{t("report.loading_title", { label })}</div>
        <p className="mx-auto mt-2.5 max-w-[380px] text-[13.5px] leading-relaxed text-muted">
          {t("report.loading_body")}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-iris"
            style={{ animation: `warm-pulse 1.4s ${i * 0.2}s ease-in-out infinite` }}
          />
        ))}
      </div>
    </div>
  );
}

function ReportError() {
  const { t } = useT();
  return (
    <div className="surface-line mx-auto mt-16 max-w-[520px] px-6 py-12 text-center">
      <div className="font-display text-lg font-500 text-ink">{t("report.error_title")}</div>
      <p className="mx-auto mt-2 max-w-[380px] text-[13px] leading-relaxed text-faint">
        {t("report.error_body")}
      </p>
    </div>
  );
}
