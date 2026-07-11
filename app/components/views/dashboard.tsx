"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useSite } from "@/components/providers";
import { useApi } from "@/components/use-api";
import { SeoOrb } from "@/components/seo-orb";
import { Sparkline } from "@/components/sparkline";
import { KineticNumber } from "@/components/kinetic-number";
import { DashboardAnalytics } from "@/components/views/dashboard-analytics";
import { QuickWinsPanel, ReviewsPanel } from "@/components/views/dashboard-insights";
import { DashboardDiagnosis, DiagnosticInstruments } from "@/components/views/dashboard-diagnosis";
import { GridComets } from "@/components/grid-comets";
import { Explain } from "@/components/explain";
import { HudReadout, IndexTag, SectionIntro, SectionLabel, Skeleton, Stagger, StaggerItem, ToneDot, TrendPill } from "@/components/ui";
import type { Advice, Anchor, Overview, Priority, ScoreBreakdownItem, SiteKey, SourceStatus, Tone } from "@/lib/types";
import type { SiteTint } from "@/components/providers";
import { cn } from "@/lib/utils";

const ENGINE = { yandex: "Яндекс", google: "Google", bing: "Bing" } as const;
const PRIO_LABEL: Record<Priority, string> = { high: "Высокий", medium: "Средний", low: "Низкий" };
const TONE_HEX: Record<Tone, string> = { good: "#4bd39a", ok: "#f4c25a", warn: "#ff6b6b" };
const TONE_GRAD: Record<Tone, string> = {
  good: "linear-gradient(120deg,#ffffff 0%,#8ff3d8 55%,#4bd39a 100%)",
  ok: "linear-gradient(120deg,#ffffff 0%,#ffe6b0 52%,#f4c25a 100%)",
  warn: "linear-gradient(120deg,#ffffff 0%,#ffc4c4 52%,#ff6b6b 100%)",
};

export function DashboardView() {
  const { site, tint, setTint } = useSite();
  const { data, loading } = useApi<Overview>(`/api/overview?site=${site}`);

  useEffect(() => {
    if (data) setTint(data.score.tone);
  }, [data, setTint]);

  if (loading || !data) return <DashboardSkeleton />;

  const actionable = data.advice.filter((a) => a.priority !== "low");

  return (
    <div className="space-y-16 lg:space-y-24">
      <HeroStage data={data} tint={tint} />

      {/* DIRECTIVES — editorial command list, on black */}
      <section>
        <SectionIntro index={1} eyebrow="Директивы" title="Что делать" />
        <div className="mt-8">
          {actionable.length === 0 ? (
            <AllGood advice={data.advice} />
          ) : (
            <Directives advice={actionable} />
          )}
        </div>
      </section>

      {/* QUICK WINS — сердце продукта: увидел → поручил рою → рой чинит */}
      <section>
        <SectionIntro
          index={2}
          eyebrow="Быстрые победы"
          title="Дожать за один ход"
          note="Запросы на границе топа. Нажмите «Поручить рою» — исполнитель усилит страницу и отправит на переобход."
        />
        <div className="mt-8">
          <QuickWinsPanel site={site} />
        </div>
      </section>

      {/* ANCHORS */}
      <section>
        <SectionIntro
          index={3}
          eyebrow="Якорные запросы"
          title="Позиции по дням"
          note="Смотрим только на целевые ВЧ-запросы — агрегаты Яндекса плавают и не показательны."
        />
        <Stagger className="mt-8 grid gap-px overflow-hidden rounded-[var(--radius-xl2)] border border-line bg-line md:grid-cols-2 xl:grid-cols-3" step={0.07}>
          {data.anchors.map((a) => (
            <StaggerItem key={a.q}>
              <AnchorCell anchor={a} site={site} />
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* DEEP ANALYTICS */}
      <DashboardAnalytics site={site} index={4} />

      {/* DIAGNOSIS — что выпало / каннибализация / угасание */}
      <DashboardDiagnosis site={site} index={5} />

      {/* INFRASTRUCTURE */}
      <section>
        <SectionIntro index={6} eyebrow="Инфраструктура" title="Данные и репутация" />
        <div className="mt-8 space-y-8">
          <DiagnosticInstruments site={site} />
          <div className="grid gap-8 lg:grid-cols-2">
            <SourcesPanel sources={data.sources} />
            <ReviewsPanel site={site} />
          </div>
        </div>
      </section>
    </div>
  );
}

/* ================================ HERO ================================ */

function HeroStage({ data, tint }: { data: Overview; tint: SiteTint }) {
  const { score, site } = data;
  const needsAttention = score.tone === "warn";
  const liveSources = data.sources.filter((s) => s.status === "live");
  const clicks7d = liveSources.reduce((a, s) => a + s.clicks7d, 0);
  const bestRep = [...data.reputation].sort((a, b) => b.rating - a.rating)[0] ?? null;

  const gauges = [
    { label: "Переходы 7д", value: String(clicks7d) },
    { label: "Источники", value: `${liveSources.length}/${data.sources.length}` },
    ...(bestRep ? [{ label: "Рейтинг", value: `${bestRep.rating.toFixed(1)}★` }] : []),
  ];

  return (
    <section className="hud-frame relative overflow-hidden pt-2">
      <GridComets color="139,147,255" step={46} className="opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 -top-10 h-64 bg-[radial-gradient(50%_100%_at_28%_0%,rgba(139,147,255,0.14),transparent_72%)]" />

      {/* identity eyebrow */}
      <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1">
        <IndexTag n="00" />
        <span className="cap">{site.kind}</span>
        <span className="text-ghost">·</span>
        <span className="cap text-ghost">{site.region}</span>
        <span className="text-ghost">·</span>
        <span className="mono text-[10.5px] tracking-[0.1em] text-ghost">{site.domain}</span>
        <div className="ml-auto flex items-center gap-2">
          {data.mock && (
            <span className="cap rounded-full border border-ok/25 bg-ok/10 px-2.5 py-1 text-ok">демо</span>
          )}
          <span className="cap rounded-full border border-line px-2.5 py-1 text-faint">скан {data.date}</span>
        </div>
      </div>

      {/* stage: orb-character + giant score + HUD sidecar */}
      <div className="relative mt-8 flex flex-col items-center gap-8 lg:mt-4 lg:flex-row lg:items-center lg:gap-4">
        <OrbCharacter tint={tint} score={score.value} tone={score.tone} attention={needsAttention} />

        <div className="min-w-0 flex-1 text-center lg:text-left">
          <div className="flex items-end justify-center gap-4 lg:justify-start">
            <span
              className="hero-num text-[clamp(6.5rem,15vw,13rem)]"
              style={{
                backgroundImage: TONE_GRAD[score.tone],
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              <Explain
                site={site.key}
                metric="Здоровье сайта"
                value={score.value}
                context={`вердикт: ${score.verdict}; шкала 0–100`}
              >
                <KineticNumber value={score.value} duration={1.8} />
              </Explain>
            </span>
            <div className="mb-4 flex flex-col items-start gap-2">
              <span className="cap">Здоровье</span>
              <span className="mono text-sm text-faint">/ 100</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-600"
              style={{
                color: TONE_HEX[score.tone],
                background: `${TONE_HEX[score.tone]}14`,
                border: `1px solid ${TONE_HEX[score.tone]}44`,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONE_HEX[score.tone] }} />
              {score.verdict}
            </span>
            <h1 className="font-display text-[clamp(1.4rem,2.6vw,2rem)] font-500 leading-none tracking-[-0.03em] text-ink">
              {site.label}
            </h1>
          </div>
        </div>

        {/* HUD sidecar gauges — bridge instruments filling the right flank */}
        <div className="hidden flex-none flex-col justify-center gap-7 pr-2 xl:flex">
          {gauges.map((g) => (
            <div key={g.label} className="flex items-center gap-3">
              <span className="h-px w-7 bg-line" />
              <span
                className="h-1.5 w-1.5 flex-none rounded-full"
                style={{ background: TONE_HEX[score.tone], boxShadow: `0 0 8px ${TONE_HEX[score.tone]}aa` }}
              />
              <div>
                <div className="cap text-[8.5px] tracking-[0.16em]">{g.label}</div>
                <div className="mono tabular mt-1 text-[19px] font-600 leading-none text-ink">{g.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* cockpit readout — score breakdown + vitals, on black */}
      <div className="relative mt-10 flex flex-col divide-y divide-line rounded-[var(--radius-xl2)] border border-line sm:flex-row sm:divide-x sm:divide-y-0">
        {score.breakdown.map((b, i) => (
          <ScoreReadout key={b.label} item={b} index={i} />
        ))}
        {bestRep && (
          <HudReadout
            label="Репутация"
            accent="#f4c25a"
            value={
              <span className="flex items-baseline gap-1.5">
                <KineticNumber value={bestRep.rating} decimals={1} />
                <span className="text-[13px]">★</span>
              </span>
            }
            sub={bestRep.dReviews != null && bestRep.dReviews > 0 ? `+${bestRep.dReviews} отзывов / нед` : bestRep.label}
            className="py-4 sm:py-5"
          />
        )}
      </div>
    </section>
  );
}

/** Orb wrapped by a score-arc aura — the product character with its own gauge. */
function OrbCharacter({
  tint,
  score,
  tone,
  attention,
}: {
  tint: SiteTint;
  score: number;
  tone: Tone;
  attention: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.12 });
  const BOX = 300;
  const orb = 208;
  const r = 132;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const col = TONE_HEX[tone];

  return (
    <div ref={ref} className="relative flex-none" style={{ width: BOX, height: BOX }}>
      {/* score-arc aura */}
      <svg width={BOX} height={BOX} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={BOX / 2} cy={BOX / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={2} />
        {/* tick marks */}
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const inner = r - 6;
          const outer = r - (i % 5 === 0 ? 12 : 9);
          const cx = BOX / 2;
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * outer}
              y1={cx + Math.sin(a) * outer}
              x2={cx + Math.cos(a) * inner}
              y2={cx + Math.sin(a) * inner}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={i % 5 === 0 ? 1.2 : 0.6}
            />
          );
        })}
        <motion.circle
          cx={BOX / 2}
          cy={BOX / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: inView ? c - c * pct : c }}
          transition={{ duration: 1.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${col}aa)` }}
        />
      </svg>

      {/* the character */}
      <div className="absolute inset-0 flex items-center justify-center">
        <SeoOrb size={orb} tint={tint} state={attention ? "alert" : "idle"} hero interactive />
      </div>
    </div>
  );
}

function ScoreReadout({ item, index }: { item: ScoreBreakdownItem; index: number }) {
  return (
    <div className="min-w-0 flex-1 px-5 py-4 sm:py-5">
      <div className="flex items-center justify-between gap-2">
        <span className="cap truncate">{item.label}</span>
        <span className="mono tabular text-[13px] text-faint">{item.value}</span>
      </div>
      <div className="mono tabular mt-2.5 text-[26px] font-600 leading-none text-ink">
        <KineticNumber value={item.value} />
      </div>
      <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg,#38e8d0,#8b93ff)" }}
          initial={{ width: 0 }}
          animate={{ width: `${item.value}%` }}
          transition={{ duration: 1.2, delay: 0.2 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <div className="mt-2 text-[11px] leading-snug text-faint">{item.hint}</div>
    </div>
  );
}

/* ============================== DIRECTIVES ============================== */

function Directives({ advice }: { advice: Advice[] }) {
  return (
    <div className="flex flex-col">
      {advice.map((a, i) => (
        <motion.div
          key={a.id}
          initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "group grid grid-cols-[auto_1fr] items-start gap-x-5 gap-y-2 py-7 sm:gap-x-8",
            i > 0 && "border-t border-line"
          )}
        >
          {/* giant ghost index + tone bar */}
          <div className="flex items-stretch gap-4 sm:gap-6">
            <span className="hero-num text-[clamp(2.4rem,5vw,4rem)] text-ghost transition-colors group-hover:text-faint">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              className="w-[3px] flex-none rounded-full"
              style={{ background: TONE_HEX[a.tone], boxShadow: `0 0 12px ${TONE_HEX[a.tone]}88` }}
            />
          </div>

          <div className="min-w-0 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="cap rounded-full px-2 py-1"
                style={{
                  color: TONE_HEX[a.tone],
                  background: `${TONE_HEX[a.tone]}14`,
                  border: `1px solid ${TONE_HEX[a.tone]}33`,
                }}
              >
                {PRIO_LABEL[a.priority]}
              </span>
              <span className="cap text-ghost">{a.tag}</span>
            </div>
            <h3 className="mt-3 font-display text-[clamp(1.15rem,2vw,1.6rem)] font-500 leading-tight tracking-[-0.02em] text-ink">
              {a.title}
            </h3>
            <p className="mt-2.5 max-w-2xl text-[14.5px] leading-relaxed text-muted">{a.body}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function AllGood({ advice }: { advice: Advice[] }) {
  const positive = advice.find((a) => a.tone === "good") ?? advice[0];
  return (
    <div className="relative grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2 sm:gap-x-10">
      <div className="relative flex-none">
        <SeoOrb size={128} tint="good" state="idle" hero />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-good">
          <CheckCircle2 size={16} />
          <span className="cap text-good">Всё под контролем</span>
        </div>
        <h3 className="mt-3 font-display text-[clamp(1.6rem,3vw,2.4rem)] font-500 leading-tight tracking-[-0.03em] text-ink">
          Всё идёт хорошо
        </h3>
        {positive && (
          <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted">{positive.body}</p>
        )}
      </div>
    </div>
  );
}

/* =============================== ANCHORS =============================== */

function AnchorCell({ anchor, site }: { anchor: Anchor; site: SiteKey }) {
  const engines = (["yandex", "google"] as const).filter((e) => anchor.engines[e]);
  const outOfIndex = engines.length === 0;
  return (
    <div className="group h-full bg-base p-6 transition-colors hover:bg-white/[0.015]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-600 text-ink" title={anchor.q}>
            {anchor.q}
          </div>
          <div className="mono mt-1.5 text-[10.5px] text-faint">
            {anchor.url} · цель топ-{anchor.goalPos}
          </div>
        </div>
        <IndexTag n={anchor.priority} />
      </div>

      {outOfIndex ? (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-warn/20 bg-warn/[0.06] px-3 py-3.5 text-sm text-warn">
          <AlertTriangle size={15} /> Пока вне выдачи — нужен внешний вес
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {engines.map((e) => {
            const ae = anchor.engines[e]!;
            const color = e === "yandex" ? "#ff6b6b" : "#8b93ff";
            return (
              <div key={e}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="cap">{ENGINE[e]}</span>
                  <span className="flex items-center gap-2">
                    <span className="mono tabular text-lg font-600 text-ink">
                      {ae.latest != null ? (
                        <Explain
                          site={site}
                          metric={`Позиция «${anchor.q}» в ${ENGINE[e]}`}
                          value={ae.latest.toFixed(1)}
                          context={`цель топ-${anchor.goalPos}; чем меньше число, тем выше в выдаче`}
                        >
                          {ae.latest.toFixed(1)}
                        </Explain>
                      ) : (
                        "—"
                      )}
                    </span>
                    <TrendPill trend={ae.trend} delta={ae.delta} />
                  </span>
                </div>
                <Sparkline values={ae.series.map((p) => p.pos)} invert color={color} height={40} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================ INFRASTRUCTURE ============================ */

function SourcesPanel({ sources }: { sources: SourceStatus[] }) {
  return (
    <div>
      <SectionLabel className="mb-4">Источники данных</SectionLabel>
      <div className="flex flex-col divide-y divide-line border-y border-line">
        {sources.map((s) => {
          const live = s.status === "live";
          return (
            <div key={s.engine} className="flex items-center gap-4 py-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {live ? <ToneDot tone={s.clicks7d > 0 ? "good" : "ok"} /> : <XCircle size={16} className="text-warn" />}
                <div className="min-w-0">
                  <div className="font-600 text-ink">{ENGINE[s.engine]}</div>
                  <div className="truncate text-[11px] text-faint">
                    {live ? `${s.queries} запросов · ${s.inTop10} в топ-10` : "нет ответа от источника"}
                  </div>
                </div>
              </div>
              {live ? (
                <div className="text-right">
                  <div className="mono tabular text-xl font-600 leading-none text-ink">
                    <KineticNumber value={s.clicks7d} />
                  </div>
                  <div className="cap mt-1.5">клики 7д</div>
                </div>
              ) : (
                <span className="cap rounded-full border border-warn/25 bg-warn/10 px-2.5 py-1 text-warn">ошибка</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =============================== SKELETON =============================== */

function DashboardSkeleton() {
  return (
    <div className="space-y-16">
      <div className="flex flex-col items-center gap-8 lg:flex-row">
        <Skeleton className="h-[300px] w-[300px] flex-none rounded-full" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-28 w-64" />
          <Skeleton className="h-8 w-40" />
        </div>
      </div>
      <Skeleton className="h-24" />
      <div className="grid gap-px md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    </div>
  );
}
