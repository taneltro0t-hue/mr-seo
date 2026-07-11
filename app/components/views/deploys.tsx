"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Fragment, useState } from "react";
import { Check, ChevronRight, FlaskConical, Rocket, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useApi } from "@/components/use-api";
import { MergeDeployButton } from "@/components/deploy-merge-button";
import { SeoOrb } from "@/components/seo-orb";
import { SiteLogo } from "@/components/site-logo";
import { IndexTag, PageHead, SectionLabel, Skeleton } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { SITES } from "@/lib/sites";
import type { DeployMerged, DeployPending, DeploysResponse, SiteKey, Tone } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Тона стадий вердикта                                               */
/* ------------------------------------------------------------------ */

const IRIS = "#8b93ff";
const VERDICT: Record<
  "confirmed" | "partial" | "falsified",
  { labelKey: string; color: string; tone: Tone }
> = {
  confirmed: { labelKey: "deploys.verdict_confirmed", color: "#4bd39a", tone: "good" },
  partial: { labelKey: "deploys.verdict_partial", color: "#f4c25a", tone: "ok" },
  falsified: { labelKey: "deploys.verdict_falsified", color: "#ff6b6b", tone: "warn" },
};

function isSiteKey(s: string): s is SiteKey {
  return s === "mysite" || s === "demo2" || s === "demo3";
}

/* ------------------------------------------------------------------ */
/*  Экран                                                              */
/* ------------------------------------------------------------------ */

export function DeploysView() {
  const { t, tn } = useT();
  // reloadKey форсит рефетч после боевого merge (route на query не смотрит).
  const [reload, setReload] = useState(0);
  const { data, loading } = useApi<DeploysResponse>(
    reload ? `/api/deploys?r=${reload}` : "/api/deploys"
  );

  if (loading && !data) return <DeploysSkeleton />;

  const pending = data?.pending ?? [];
  const merged = data?.merged ?? [];
  const verifying = merged.filter((m) => m.stage === "verifying");
  const verdicts = merged.filter((m) => m.stage !== "verifying");

  const refetchSoon = () => window.setTimeout(() => setReload((r) => r + 1), 1400);

  return (
    <div className="space-y-14 lg:space-y-20">
      <PageHead
        eyebrow={t("deploys.eyebrow")}
        title={t("deploys.title")}
        lede={t("deploys.lede")}
        right={
          <span
            className={cn(
              "cap rounded-full border px-2.5 py-1",
              pending.length > 0 ? "border-iris/40 text-iris" : "border-line text-faint"
            )}
          >
            {t("deploys.count_badge", { count: pending.length })}
          </span>
        }
      />

      {/* 01 — Ждут твоего merge (герой конвейера) */}
      <section className="min-w-0">
        <SectionHead n="01" label={t("deploys.sec_pending")} count={pending.length} word={tn("branch", pending.length)} />
        {pending.length === 0 ? (
          <EmptyState Icon={Rocket} title={t("deploys.empty_title")} body={t("deploys.empty_body")} />
        ) : (
          <div className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {pending.map((d, i) => (
                <PendingCard key={d.branch} deploy={d} index={i} onMerged={refetchSoon} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* 02 — В работе у поиска */}
      <section className="min-w-0">
        <SectionHead n="02" label={t("deploys.sec_verifying")} count={verifying.length} word={tn("deploy", verifying.length)} />
        {verifying.length === 0 ? (
          <EmptyState
            Icon={FlaskConical}
            title={t("deploys.verifying_empty_title")}
            body={t("deploys.verifying_empty_body")}
            subtle
          />
        ) : (
          <div className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {verifying.map((d, i) => (
                <MergedCard key={d.id} deploy={d} index={i} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* 03 — Итоги */}
      <section className="min-w-0">
        <SectionHead n="03" label={t("deploys.sec_verdicts")} count={verdicts.length} word={tn("verdict", verdicts.length)} />
        {verdicts.length === 0 ? (
          <EmptyState
            Icon={Sparkles}
            title={t("deploys.verdicts_empty_title")}
            body={t("deploys.verdicts_empty_body")}
            subtle
          />
        ) : (
          <div className="flex flex-col gap-4">
            {verdicts.map((d, i) => (
              <MergedCard key={d.id} deploy={d} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Заголовок секции                                                   */
/* ------------------------------------------------------------------ */

function SectionHead({ n, label, count, word }: { n: string; label: string; count: number; word: string }) {
  return (
    <div className="mb-5 flex items-baseline gap-3">
      <IndexTag n={n} />
      <SectionLabel>{label}</SectionLabel>
      <span className="mono text-[11px] text-faint">{count > 0 ? `${count} ${word}` : "—"}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Шапка карточки: сайт + задача + sha·дата                           */
/* ------------------------------------------------------------------ */

function CardHead({ site, task, sha, date }: { site: string; task: string; sha?: string | null; date?: string | null }) {
  const meta = isSiteKey(site) ? SITES[site] : null;
  return (
    <div className="flex items-start gap-3">
      {meta ? (
        <SiteLogo site={meta.key} size={30} rounded="rounded-lg" />
      ) : (
        <span className="mono flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg border border-line text-[10px] text-faint">
          {site.slice(0, 2)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-600 text-ink">{meta?.label ?? site}</span>
          {meta && <span className="cap text-ghost">{meta.region}</span>}
        </div>
        {task && <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{task}</p>}
      </div>
      {(sha || date) && (
        <div className="mono flex flex-none flex-col items-end gap-0.5 pt-0.5 text-[10.5px] text-ghost">
          {sha && <span className="text-faint">{sha}</span>}
          {date && <span>{date}</span>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Пайплайн стадий                                                    */
/* ------------------------------------------------------------------ */

type StageState = "done" | "active" | "upcoming";

function Pipeline({
  activeIndex,
  color,
  pulse,
  ripeningSub,
  verdictLabel,
}: {
  activeIndex: number; // 0..3
  color: string; // hex активной стадии
  pulse?: boolean; // iris-пульс для «зреет»
  ripeningSub?: string; // «до 2026-07-20»
  verdictLabel?: string; // подпись 4-й стадии, если вердикт вынесен
}) {
  const { t } = useT();
  const stages: { label: string; sub?: string }[] = [
    { label: t("deploys.stage_ready") },
    { label: t("deploys.stage_merged") },
    { label: t("deploys.stage_ripening"), sub: ripeningSub },
    { label: verdictLabel ?? t("deploys.stage_verdict") },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {stages.map((s, i) => {
        const state: StageState = i < activeIndex ? "done" : i === activeIndex ? "active" : "upcoming";
        return (
          <Fragment key={i}>
            <StagePill label={s.label} sub={s.sub} state={state} color={color} pulse={pulse && state === "active"} />
            {i < stages.length - 1 && (
              <ChevronRight
                size={14}
                strokeWidth={2.2}
                className={cn("flex-none transition-colors", i < activeIndex ? "text-muted" : "text-ghost/50")}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function StagePill({
  label,
  sub,
  state,
  color,
  pulse,
}: {
  label: string;
  sub?: string;
  state: StageState;
  color: string;
  pulse?: boolean;
}) {
  const active = state === "active";
  const done = state === "done";
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-600 transition-colors",
        active && "text-ink",
        done && "border-line bg-white/[0.03] text-muted",
        !active && !done && "border-line/60 text-ghost"
      )}
      style={
        active
          ? { borderColor: `${color}55`, background: `${color}14`, color }
          : undefined
      }
    >
      {done ? (
        <Check size={11} strokeWidth={3} className="text-muted" />
      ) : (
        <span
          className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", pulse && "warm-pulse")}
          style={{ background: active ? color : "transparent", boxShadow: active ? `0 0 8px ${color}` : undefined, border: active ? undefined : "1px solid currentColor" }}
        />
      )}
      <span className="whitespace-nowrap">{label}</span>
      {sub && <span className="mono ml-0.5 text-[10px] font-500 opacity-80">{sub}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Карточки                                                           */
/* ------------------------------------------------------------------ */

const cardMotion = {
  initial: { opacity: 0, y: 18, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -14, filter: "blur(6px)", transition: { duration: 0.3 } },
};

function PendingCard({ deploy, index, onMerged }: { deploy: DeployPending; index: number; onMerged: () => void }) {
  return (
    <motion.article
      layout
      {...cardMotion}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="surface-line relative overflow-hidden p-5 sm:p-6"
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: IRIS, boxShadow: `0 0 14px ${IRIS}66` }} />
      <div className="pl-2">
        <CardHead site={deploy.site} task={deploy.task} sha={deploy.sha} date={deploy.date} />
        <div className="mt-5">
          <Pipeline activeIndex={0} color={IRIS} />
        </div>
        <div className="mt-5">
          <MergeDeployButton site={deploy.site} branch={deploy.branch} onMerged={onMerged} />
        </div>
      </div>
    </motion.article>
  );
}

function MergedCard({ deploy, index }: { deploy: DeployMerged; index: number }) {
  const { t } = useT();
  const isVerdict = deploy.stage !== "verifying";
  const v = isVerdict ? VERDICT[deploy.stage as "confirmed" | "partial" | "falsified"] : null;
  const color = v?.color ?? IRIS;
  const activeIndex = isVerdict ? 3 : 2;
  const ripeningSub = deploy.verify_due ? t("deploys.until", { date: deploy.verify_due }) : undefined;
  const verdictLabel = v ? t(v.labelKey) : undefined;

  return (
    <motion.article
      layout
      {...cardMotion}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="surface-line relative overflow-hidden p-5 sm:p-6"
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color, boxShadow: `0 0 12px ${color}55` }} />
      <div className="pl-2">
        <CardHead site={deploy.site} task={deploy.task} sha={deploy.sha} date={deploy.date} />
        <div className="mt-5">
          <Pipeline
            activeIndex={activeIndex}
            color={color}
            pulse={!isVerdict}
            ripeningSub={ripeningSub}
            verdictLabel={verdictLabel}
          />
        </div>

        {/* выдержка вердикта */}
        {isVerdict && deploy.verdict && (
          <p className="mt-4 border-l-2 pl-3 text-[13px] leading-relaxed text-muted" style={{ borderColor: `${color}55` }}>
            {deploy.verdict}
          </p>
        )}

        {/* сдвинувшиеся запросы */}
        {deploy.targets.length > 0 && (
          <div className="mt-4">
            <div className="cap mb-2 text-ghost">{t("deploys.targets_moved")}</div>
            <div className="flex flex-wrap gap-1.5">
              {deploy.targets.slice(0, 8).map((q, i) => (
                <span key={i} className="mono truncate rounded-md border border-line bg-white/[0.02] px-2 py-1 text-[10.5px] text-faint" title={q}>
                  {q}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.article>
  );
}

/* ------------------------------------------------------------------ */
/*  Общее                                                              */
/* ------------------------------------------------------------------ */

function EmptyState({
  Icon,
  title,
  body,
  subtle,
}: {
  Icon: LucideIcon;
  title: string;
  body: string;
  subtle?: boolean;
}) {
  return (
    <div className="surface-line flex flex-col items-center gap-4 px-6 py-12 text-center">
      {subtle ? (
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-white/[0.02]">
          <Icon size={22} className="text-faint" />
        </div>
      ) : (
        <SeoOrb size={64} tint="neutral" state="idle" />
      )}
      <div>
        <div className="font-display text-lg font-500 text-ink">{title}</div>
        <p className="mx-auto mt-2 max-w-[380px] text-[13px] leading-relaxed text-faint">{body}</p>
      </div>
    </div>
  );
}

function DeploysSkeleton() {
  return (
    <div className="space-y-14">
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {[0, 1].map((s) => (
        <div key={s} className="space-y-4">
          <Skeleton className="h-4 w-48" />
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ))}
    </div>
  );
}
