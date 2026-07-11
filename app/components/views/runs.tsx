"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { useApi } from "@/components/use-api";
import { useT } from "@/lib/i18n";
import { FadeIn, PageHead, Skeleton } from "@/components/ui";
import type { RunSummary, RunsResponse, Tone } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE_BAR: Record<Tone, string> = {
  good: "border-l-good bg-good/[0.05]",
  ok: "border-l-ok bg-ok/[0.05]",
  warn: "border-l-warn bg-warn/[0.05]",
};

export function RunsView() {
  const { t } = useT();
  const { data, loading } = useApi<RunsResponse>("/api/runs");
  if (loading || !data) return <RunsSkeleton />;

  return (
    <div className="space-y-12">
      <PageHead
        eyebrow={t("runs.eyebrow")}
        title={t("runs.title")}
        lede={t("runs.lede")}
        right={
          data.mock ? (
            <span className="cap rounded-full border border-ok/25 bg-ok/10 px-2.5 py-1 text-ok">демо</span>
          ) : undefined
        }
      />

      <div className="space-y-5">
        {data.runs.map((run, i) => (
          <FadeIn key={run.slug} delay={i * 0.06}>
            <RunCard run={run} defaultOpen={i === 0} />
          </FadeIn>
        ))}
      </div>
    </div>
  );
}

function RunCard({ run, defaultOpen }: { run: RunSummary; defaultOpen: boolean }) {
  return (
    <div className="surface-line overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-6 py-4">
        <CalendarDays size={17} className="text-iris" />
        <div>
          <div className="font-display text-lg font-500 tracking-[-0.01em]">{run.title}</div>
          <div className="cap mt-1">{run.date}</div>
        </div>
      </div>

      <div className="space-y-2.5 p-6">
        {run.signals.length === 0 ? (
          <div className="text-sm text-faint">Сигналов не найдено — см. полный отчёт.</div>
        ) : (
          run.signals.map((s, i) => (
            <div
              key={i}
              className={cn("rounded-xl border border-line border-l-2 px-4 py-3", TONE_BAR[s.tone])}
            >
              <div className="mb-0.5 text-xs font-600 uppercase tracking-wider text-muted">
                {s.site}
              </div>
              <p className="text-sm leading-relaxed text-ink/90">{s.text}</p>
            </div>
          ))
        )}

        <details className="group mt-2" open={defaultOpen}>
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-600 text-faint transition-colors hover:text-ink">
            <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
            Полный отчёт
          </summary>
          <pre className="mono mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl border border-line bg-base/60 p-4 text-[12.5px] leading-relaxed text-muted">
            {run.markdown}
          </pre>
        </details>
      </div>
    </div>
  );
}

function RunsSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-16 w-72" />
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-64" />
      ))}
    </div>
  );
}
