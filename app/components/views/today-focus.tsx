"use client";

import { motion } from "framer-motion";
import { Target, UserRound } from "lucide-react";
import { useApi } from "@/components/use-api";
import { DispatchButton } from "@/components/views/dashboard-insights";
import { SiteLogo } from "@/components/site-logo";
import { SectionLabel } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { SITES, isSiteKey } from "@/lib/sites";
import type { FocusItem, FocusResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * «Фокус недели» — герой экрана «Сегодня». Мозг раз в неделю выбирает РОВНО три
 * дела максимальной отдачи (swarm/focus.py, кеш недели). Это первое, что видит
 * пользователь утром: три командные директивы над колонками ночь/действия.
 * У дел исполнителя «рой» — кнопка «Поручить» (готовый action → /api/tasks).
 */
export function WeekFocus() {
  const { t } = useT();
  const { data, loading } = useApi<FocusResponse>("/api/focus");

  if (loading) return <FocusSkeleton />;
  const items = data?.focus ?? [];
  if (!data || items.length === 0 || data.error) return null;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="flex items-center gap-2.5">
          <Target size={17} className="text-iris" />
          <SectionLabel>{t("focus.title")}</SectionLabel>
          {data.week && <span className="mono text-[11px] text-ghost">{data.week}</span>}
        </div>
        <p className="max-w-[360px] text-[12.5px] leading-relaxed text-faint">
          {t("focus.subtitle")}
        </p>
      </div>

      <div className="mt-6 grid gap-px overflow-hidden rounded-[var(--radius-xl2)] border border-line bg-line lg:grid-cols-3">
        {items.slice(0, 3).map((f, i) => (
          <FocusCard key={`${f.site}:${f.title}`} item={f} index={i} />
        ))}
      </div>
    </section>
  );
}

function FocusCard({ item, index }: { item: FocusItem; index: number }) {
  const { t } = useT();
  const meta = isSiteKey(item.site) ? SITES[item.site] : null;
  const isRoy = String(item.executor) === "рой" || String(item.executor) === "swarm";

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex h-full flex-col bg-base p-6 transition-colors hover:bg-white/[0.015]"
    >
      {/* rail: giant ghost index + канал */}
      <div className="flex items-center justify-between gap-3">
        <span className="hero-num text-[clamp(2rem,4vw,3rem)] text-ghost transition-colors group-hover:text-faint">
          {String(index + 1).padStart(2, "0")}
        </span>
        {meta ? (
          <span className="inline-flex items-center gap-2">
            <SiteLogo site={meta.key} size={26} rounded="rounded-lg" />
            <span className="cap" style={{ color: meta.accent }}>
              {meta.label}
            </span>
          </span>
        ) : (
          <span className="cap text-faint">{item.site}</span>
        )}
      </div>

      <h3 className="mt-4 font-display text-[clamp(1.15rem,1.7vw,1.4rem)] font-500 leading-tight tracking-[-0.02em] text-ink">
        {item.title}
      </h3>
      <p className="mt-2.5 flex-1 text-[13px] leading-relaxed text-muted">{item.why}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <ExecutorChip executor={item.executor} />
        {isRoy && (
          <div className="ml-auto">
            <DispatchButton text={item.action} idleLabel={t("common.dispatch_short")} doneLabel={t("common.queued")} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ExecutorChip({ executor }: { executor: FocusItem["executor"] }) {
  const { t } = useT();
  const roy = String(executor) === "рой" || String(executor) === "swarm";
  return (
    <span
      className={cn(
        "mono inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-600",
        roy
          ? "border-iris/30 bg-iris/10 text-iris"
          : "border-ok/30 bg-ok/10 text-ok"
      )}
    >
      {roy ? (
        <span className="h-1.5 w-1.5 rounded-full bg-iris shadow-[0_0_8px_rgba(139,147,255,0.8)]" />
      ) : (
        <UserRound size={11} />
      )}
      {roy ? t("focus.exec_roy") : t("focus.exec_human")}
    </span>
  );
}

function FocusSkeleton() {
  const { t } = useT();
  return (
    <section>
      <div className="flex items-center gap-2.5">
        <Target size={17} className="text-iris/60" />
        <SectionLabel>{t("focus.title")}</SectionLabel>
      </div>
      <div className="mt-6 grid gap-px overflow-hidden rounded-[var(--radius-xl2)] border border-line bg-line lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex min-h-[240px] flex-col items-center justify-center gap-4 bg-base p-6 text-center">
            <motion.span
              className="h-3 w-3 rounded-full bg-iris"
              animate={{ opacity: [1, 0.3, 1], scale: [1, 0.7, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
              style={{ boxShadow: "0 0 12px rgba(139,147,255,0.7)" }}
            />
            <div className="mono text-[11px] leading-relaxed text-faint">
              {t("focus.thinking")}
              <br />
              <span className="text-ghost">{t("focus.thinking_sub")}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
