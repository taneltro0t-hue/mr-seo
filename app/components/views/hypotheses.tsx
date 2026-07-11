"use client";

import { motion } from "framer-motion";
import { Skull, Sprout } from "lucide-react";
import { useApi } from "@/components/use-api";
import { FadeIn, PageHead, Panel, SectionLabel, Skeleton } from "@/components/ui";
import { KineticNumber } from "@/components/kinetic-number";
import type { Hypothesis, HypoStatus, HypothesesResponse, Lesson, Tone } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const STATUS_TONE: Record<HypoStatus, Tone | "neutral"> = {
  proposed: "neutral",
  pending: "ok",
  observe: "ok",
  confirmed: "good",
  partial: "ok",
  falsified: "warn",
};

const DOT: Record<string, string> = {
  neutral: "#8b93ff",
  ok: "#f4c25a",
  good: "#4bd39a",
  warn: "#ff6b6b",
};

export function HypothesesView() {
  const { t } = useT();
  const { data, loading } = useApi<HypothesesResponse>("/api/hypotheses");
  if (loading || !data) return <HypoSkeleton />;

  return (
    <div className="space-y-12">
      <PageHead
        eyebrow={t("hypo.eyebrow")}
        title={t("nav.hypotheses")}
        lede={t("hypo.lede")}
        right={
          data.mock ? (
            <span className="cap rounded-full border border-ok/25 bg-ok/10 px-2.5 py-1 text-ok">{t("hypo.demo")}</span>
          ) : undefined
        }
      />

      {/* stats — HUD strip */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 divide-line rounded-[var(--radius-xl2)] border border-line sm:grid-cols-4 sm:divide-x">
          <Stat label={t("hypo.stat_total")} value={data.stats.total} tone="neutral" />
          <Stat label={t("hypo.stat_active")} value={data.stats.active} tone="ok" />
          <Stat label={t("hypo.stat_confirmed")} value={data.stats.confirmed} tone="good" />
          <Stat label={t("hypo.stat_falsified")} value={data.stats.falsified} tone="warn" />
        </div>
      </FadeIn>

      {/* pipeline */}
      <FadeIn delay={0.1}>
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-3">
          {data.columns.map((col) => (
            <div key={col.status} className="flex w-[300px] flex-none flex-col">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: DOT[STATUS_TONE[col.status]] }}
                />
                <span className="text-sm font-600">{col.label}</span>
                <span className="mono ml-auto text-xs text-faint">{col.items.length}</span>
              </div>
              <div className="space-y-3">
                {col.items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-line px-3 py-6 text-center text-xs text-faint">
                    {t("hypo.empty")}
                  </div>
                ) : (
                  col.items.map((h, i) => <HypoCard key={h.id} h={h} delay={i * 0.03} />)
                )}
              </div>
            </div>
          ))}
        </div>
      </FadeIn>

      {/* graveyard */}
      <FadeIn delay={0.12}>
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Skull size={18} className="text-faint" />
            <SectionLabel>Кладбище уроков</SectionLabel>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {data.lessons.map((l, i) => (
              <LessonCard key={l.id} lesson={l} delay={i * 0.04} />
            ))}
          </div>
        </section>
      </FadeIn>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="px-5 py-5">
      <div className="cap">{label}</div>
      <div className="mono tabular mt-3 text-[30px] font-600 leading-none" style={{ color: DOT[tone] }}>
        <KineticNumber value={value} />
      </div>
    </div>
  );
}

function HypoCard({ h, delay }: { h: Hypothesis; delay: number }) {
  const tone = STATUS_TONE[h.status];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45 }}
      className="surface-line rounded-2xl p-4"
      style={{ borderLeft: `2px solid ${DOT[tone]}` }}
    >
      <div className="flex items-center justify-between">
        <span className="mono text-[11px] text-faint">{h.id}</span>
        <span className="mono rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">
          {h.site}
        </span>
      </div>
      <p className="mt-2 text-sm leading-snug text-ink/90" style={clamp(3)}>
        {h.change}
      </p>
      {h.expected && (
        <p className="mt-2 text-xs leading-snug text-faint" style={clamp(2)}>
          Ожидание: {h.expected}
        </p>
      )}
      <div className="mono mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-faint">
        {h.commit_date && <span>📅 {h.commit_date}</span>}
        {h.executor && <span>👤 {h.executor}</span>}
        {h.verify_due && <span>⏱ {h.verify_due}</span>}
      </div>
    </motion.div>
  );
}

function LessonCard({ lesson, delay }: { lesson: Lesson; delay: number }) {
  const good = lesson.kind === "confirmed";
  return (
    <FadeIn delay={delay}>
      <Panel className="h-full p-5">
        <div className="mb-2 flex items-center gap-2">
          <span
            className={cn(
              "mono flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-600",
              good ? "bg-good/10 text-good" : "bg-warn/10 text-warn"
            )}
          >
            {good ? <Sprout size={11} /> : <Skull size={11} />} {lesson.id}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-faint">
            {good ? "работает" : "не работает"}
          </span>
        </div>
        <div className="font-600 leading-snug">{lesson.title}</div>
        <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-muted" style={clamp(6)}>
          {lesson.body}
        </p>
      </Panel>
    </FadeIn>
  );
}

function clamp(lines: number): React.CSSProperties {
  return {
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };
}

function HypoSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-16 w-72" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64 w-[300px] flex-none" />
        ))}
      </div>
    </div>
  );
}
