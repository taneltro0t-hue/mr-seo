"use client";

import { motion } from "framer-motion";
import { ClipboardCheck, FlaskConical, GitMerge, GitPullRequestArrow, LineChart } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useSite } from "@/components/providers";
import { useApi } from "@/components/use-api";
import { PageHead, Skeleton, TrendPill } from "@/components/ui";
import type {
  TimelineEvent,
  TimelineEventType,
  TimelinePoint,
  TimelineResponse,
  Trend,
} from "@/lib/types";
import { splitQueryTag } from "@/lib/utils";

const PALETTE = ["#8b93ff", "#38e8d0", "#f4c25a", "#4bd39a", "#ff6b6b", "#c08bff", "#5ad9ff", "#ff9f6b"];

const EV: Record<TimelineEventType, { label: string; color: string; Icon: LucideIcon }> = {
  commit: { label: "Правка", color: "#8b93ff", Icon: GitMerge },
  bridge: { label: "Мост", color: "#38e8d0", Icon: GitPullRequestArrow },
  hypothesis: { label: "Гипотеза", color: "#f4c25a", Icon: FlaskConical },
  verdict: { label: "Вердикт", color: "#4bd39a", Icon: ClipboardCheck },
};

function eventColor(e: TimelineEvent): string {
  if (e.type === "verdict") {
    if (e.status === "falsified") return "#ff6b6b";
    if (e.status === "partial") return "#f4c25a";
    return "#4bd39a";
  }
  return EV[e.type].color;
}

const DAY = 86_400_000;
const ts = (d: string) => Date.parse(d + "T00:00:00");
const fmtShort = (t: number) => {
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const fmtFull = (ds: string) => {
  const t = ts(ds);
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

export function TimelineView() {
  const { site } = useSite();
  const { data, loading } = useApi<TimelineResponse>(`/api/timeline?site=${site}&days=45`);

  if (loading || !data) return <TimelineSkeleton />;

  const series = data.series ?? {};
  const keys = Object.keys(series).filter((k) => (series[k] ?? []).length > 0);
  const events = data.events ?? [];

  return (
    <div className="space-y-10">
      <PageHead
        eyebrow="ROI · динамика"
        title="Позиции и правки"
        lede="Линии — позиции якорных запросов (чем выше, тем ближе к топу). Вертикальные метки — реальные действия роя. Видно глазами: правка → график двинулся."
      />

      {keys.length === 0 ? (
        <div className="surface-line flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-white/[0.02]">
            <LineChart size={22} className="text-faint" />
          </div>
          <div>
            <div className="font-display text-lg font-500 text-ink">Истории пока нет</div>
            <p className="mx-auto mt-2 max-w-[360px] text-[13px] leading-relaxed text-faint">
              График появится, когда накопится несколько сканов позиций по якорным запросам этого проекта.
            </p>
          </div>
        </div>
      ) : (
        <>
          <PositionChart series={series} keys={keys} events={events} />
          <Legend series={series} keys={keys} />
          <EventKey />
        </>
      )}
    </div>
  );
}

/* ================================ CHART ================================ */

const W = 1000;
const H = 460;
const M = { l: 48, r: 22, t: 20, b: 72 };
const PX0 = M.l;
const PX1 = W - M.r;
const PY0 = M.t;
const PY1 = H - M.b;

interface HoverState {
  ds: string;
  t: number;
}

function PositionChart({
  series,
  keys,
  events,
}: {
  series: Record<string, TimelinePoint[]>;
  keys: string[];
  events: TimelineEvent[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  const model = useMemo(() => {
    const lines = keys.map((k, i) => {
      const pts = [...(series[k] ?? [])]
        .map((p) => ({ t: ts(p.date), pos: p.pos, date: p.date }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.pos))
        .sort((a, b) => a.t - b.t);
      return { key: k, color: PALETTE[i % PALETTE.length], pts };
    });

    const allT: number[] = [];
    const allPos: number[] = [];
    lines.forEach((l) => l.pts.forEach((p) => { allT.push(p.t); allPos.push(p.pos); }));
    events.forEach((e) => { const t = ts(e.date); if (Number.isFinite(t)) allT.push(t); });

    let minT = Math.min(...allT);
    let maxT = Math.max(...allT);
    if (minT === maxT) { minT -= DAY; maxT += DAY; }

    const minPos = Math.min(...allPos);
    const maxPos = Math.max(...allPos);
    const padP = Math.max(1, (maxPos - minPos) * 0.14);
    const lo = Math.max(1, minPos - padP);
    const hi = maxPos + padP;

    // union of dates (series + events) for hover snapping
    const dateSet = new Map<string, number>();
    lines.forEach((l) => l.pts.forEach((p) => dateSet.set(p.date, p.t)));
    events.forEach((e) => { const t = ts(e.date); if (Number.isFinite(t)) dateSet.set(e.date, t); });
    const union = [...dateSet.entries()].map(([ds, t]) => ({ ds, t })).sort((a, b) => a.t - b.t);

    // events grouped by date
    const evByDate = new Map<string, TimelineEvent[]>();
    events.forEach((e) => {
      const arr = evByDate.get(e.date) ?? [];
      arr.push(e);
      evByDate.set(e.date, arr);
    });

    return { lines, minT, maxT, lo, hi, union, evByDate };
  }, [series, keys, events]);

  const { lines, minT, maxT, lo, hi, union, evByDate } = model;

  const mapX = (t: number) => PX0 + ((t - minT) / (maxT - minT)) * (PX1 - PX0);
  const mapY = (pos: number) => PY0 + ((pos - lo) / (hi - lo)) * (PY1 - PY0);

  // Y ticks — nice-ish integer positions
  const yTicks = useMemo(() => {
    const span = hi - lo;
    const step = span <= 6 ? 1 : span <= 14 ? 2 : span <= 30 ? 5 : 10;
    const out: number[] = [];
    const start = Math.ceil(lo / step) * step;
    for (let v = start; v <= hi; v += step) out.push(v);
    return out;
  }, [lo, hi]);

  // X ticks — ~6 evenly spaced dates
  const xTicks = useMemo(() => {
    const n = 6;
    return Array.from({ length: n }, (_, i) => minT + ((maxT - minT) * i) / (n - 1));
  }, [minT, maxT]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || union.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const ux = ((e.clientX - rect.left) / rect.width) * W;
    const t = minT + ((ux - PX0) / (PX1 - PX0)) * (maxT - minT);
    let best = union[0];
    let bd = Infinity;
    for (const u of union) {
      const d = Math.abs(u.t - t);
      if (d < bd) { bd = d; best = u; }
    }
    setHover({ ds: best.ds, t: best.t });
  };

  const hoverX = hover ? mapX(hover.t) : 0;
  const hoverEvents = hover ? evByDate.get(hover.ds) ?? [] : [];
  // series value near the snapped date (within 2 days)
  const hoverVals = hover
    ? lines
        .map((l) => {
          let bp: (typeof l.pts)[number] | null = null;
          let bd = Infinity;
          for (const p of l.pts) {
            const d = Math.abs(p.t - hover.t);
            if (d < bd) { bd = d; bp = p; }
          }
          return bp && bd <= 2 * DAY ? { color: l.color, key: l.key, pos: bp.pos } : null;
        })
        .filter((v): v is { color: string; key: string; pos: number } => v != null)
    : [];

  const tipLeftPct = hover ? (hoverX / W) * 100 : 0;

  return (
    <div className="surface-line relative overflow-hidden p-2 sm:p-4">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full"
        style={{ height: "auto" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="График позиций якорных запросов с метками правок"
      >
        {/* horizontal gridlines + Y labels */}
        {yTicks.map((v) => {
          const y = mapY(v);
          return (
            <g key={`y${v}`}>
              <line x1={PX0} y1={y} x2={PX1} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <text x={PX0 - 8} y={y + 3.5} textAnchor="end" className="mono" fontSize={10} fill="rgba(255,255,255,0.42)">
                {v}
              </text>
            </g>
          );
        })}
        {/* top label — "лучше" */}
        <text x={PX0 - 8} y={PY0 - 6} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.24)" className="mono">
          топ
        </text>

        {/* X date labels */}
        {xTicks.map((t, i) => (
          <text
            key={`x${i}`}
            x={mapX(t)}
            y={PY1 + 20}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            fontSize={10}
            fill="rgba(255,255,255,0.42)"
            className="mono"
          >
            {fmtShort(t)}
          </text>
        ))}
        {/* baseline */}
        <line x1={PX0} y1={PY1} x2={PX1} y2={PY1} stroke="rgba(255,255,255,0.14)" strokeWidth={1} />

        {/* event vertical hairlines + bottom dots */}
        {[...evByDate.entries()].map(([ds, evs]) => {
          const x = mapX(ts(ds));
          const active = hover?.ds === ds;
          return (
            <g key={`ev${ds}`}>
              <line
                x1={x}
                y1={PY0}
                x2={x}
                y2={PY1}
                stroke={eventColor(evs[0])}
                strokeWidth={active ? 1.4 : 1}
                strokeDasharray="3 4"
                opacity={active ? 0.5 : 0.22}
              />
              {evs.slice(0, 4).map((e, j) => (
                <motion.circle
                  key={j}
                  cx={x}
                  cy={PY1 + 14 + j * 9}
                  r={active ? 3.6 : 3}
                  fill={eventColor(e)}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.6 + j * 0.05, type: "spring", stiffness: 300 }}
                />
              ))}
              {evs.length > 4 && (
                <text x={x + 6} y={PY1 + 14 + 4 * 9} fontSize={8} fill="rgba(255,255,255,0.42)" className="mono">
                  +{evs.length - 4}
                </text>
              )}
            </g>
          );
        })}

        {/* series lines */}
        {lines.map((l, li) => {
          if (l.pts.length < 2) return null;
          const d = l.pts.map((p, i) => `${i === 0 ? "M" : "L"}${mapX(p.t).toFixed(1)},${mapY(p.pos).toFixed(1)}`).join(" ");
          const last = l.pts[l.pts.length - 1];
          return (
            <g key={l.key}>
              <motion.path
                d={d}
                fill="none"
                stroke={l.color}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.2, delay: li * 0.12, ease: "easeOut" }}
              />
              <motion.circle
                cx={mapX(last.t)}
                cy={mapY(last.pos)}
                r={3.4}
                fill={l.color}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1 + li * 0.12, type: "spring", stiffness: 300 }}
              />
            </g>
          );
        })}

        {/* hover crosshair + snapped series dots */}
        {hover && (
          <g>
            <line x1={hoverX} y1={PY0} x2={hoverX} y2={PY1} stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
            {hoverVals.map((v) => (
              <circle key={v.key} cx={hoverX} cy={mapY(v.pos)} r={4.5} fill={v.color} stroke="#000" strokeWidth={1.5} />
            ))}
          </g>
        )}
      </svg>

      {/* tooltip */}
      {hover && (hoverVals.length > 0 || hoverEvents.length > 0) && (
        <div
          className="pointer-events-none absolute top-3 z-10 w-[240px] -translate-x-1/2 rounded-xl border border-line bg-base-2/95 p-3 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
          style={{ left: `clamp(124px, ${tipLeftPct}%, calc(100% - 124px))` }}
        >
          <div className="cap mb-2">{fmtFull(hover.ds)}</div>
          {hoverVals.map((v) => {
            const { query } = splitQueryTag(v.key);
            return (
              <div key={v.key} className="flex items-center gap-2 py-0.5">
                <span className="h-2 w-2 flex-none rounded-full" style={{ background: v.color }} />
                <span className="min-w-0 flex-1 truncate text-[12px] text-muted" title={query}>{query}</span>
                <span className="mono tabular text-[12px] font-600 text-ink">{v.pos.toFixed(1).replace(/\.0$/, "")}</span>
              </div>
            );
          })}
          {hoverEvents.length > 0 && (
            <div className="mt-2 space-y-1.5 border-t border-line pt-2">
              {hoverEvents.map((e, i) => {
                const meta = EV[e.type];
                const c = eventColor(e);
                const MetaIcon = meta.Icon;
                return (
                  <div key={i} className="flex items-start gap-2">
                    <MetaIcon size={12} style={{ color: c }} className="mt-0.5 flex-none" />
                    <span className="text-[11px] leading-snug text-faint">
                      <span className="font-600" style={{ color: c }}>{meta.label}: </span>
                      {e.title.length > 90 ? e.title.slice(0, 90) + "…" : e.title}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================ LEGEND ================================ */

function Legend({ series, keys }: { series: Record<string, TimelinePoint[]>; keys: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {keys.map((k, i) => {
        const pts = series[k] ?? [];
        const first = pts[0]?.pos ?? null;
        const last = pts[pts.length - 1]?.pos ?? null;
        const { query, engine } = splitQueryTag(k);
        const color = PALETTE[i % PALETTE.length];
        // улучшение позиций = число уменьшилось → delta положит.
        const delta = first != null && last != null ? first - last : null;
        const trend: Trend = delta == null || Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "up" : "down";
        return (
          <div key={k} className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.015] px-4 py-3">
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}88` }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-600 text-ink" title={query}>{query}</div>
              {engine && (
                <div className="cap mt-0.5" style={{ color: engine === "yandex" ? "#ff6b6b" : "#8b93ff" }}>
                  {engine === "yandex" ? "Яндекс" : "Google"}
                </div>
              )}
            </div>
            <div className="flex flex-none items-center gap-2">
              <span className="mono tabular text-[15px] font-600 text-ink">{last != null ? last.toFixed(1).replace(/\.0$/, "") : "—"}</span>
              <TrendPill trend={trend} delta={delta} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventKey() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-white/[0.01] px-4 py-3">
      <span className="cap text-ghost">Метки</span>
      {(Object.keys(EV) as TimelineEventType[]).map((t) => {
        const { label, color, Icon } = EV[t];
        return (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            <Icon size={12} style={{ color }} />
            <span className="text-[12px] text-muted">{label}</span>
          </span>
        );
      })}
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-72" />
      </div>
      <Skeleton className="h-[360px]" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}
      </div>
    </div>
  );
}
