import "server-only";
import type {
  Anchor,
  AnchorEngine,
  Overview,
  QueryStat,
  ReputationItem,
  Snapshot,
  SourceStatus,
  SparkPoint,
  SiteKey,
  Trend,
} from "./types";
import { ANCHORS, REPUTATION_MAP, SITES } from "./sites";
import { computeScore } from "./score";
import { buildAdvice } from "./advice";
import {
  readReputationRange,
  readSnapshotRange,
  type RawReputationFile,
} from "./fs-data";
import { MOCK_OVERVIEWS } from "./mock";

const WINDOW = 21;
const COMPARE_LAG = 7;

function engineMap(
  snap: Snapshot,
  engine: "yandex" | "google" | "bing"
): Record<string, QueryStat> | null {
  const v = snap[engine];
  if (!v || typeof v !== "object") return null;
  if ("error" in v) return null;
  return v as Record<string, QueryStat>;
}

function findStat(
  map: Record<string, QueryStat> | null,
  q: string
): QueryStat | null {
  if (!map) return null;
  if (map[q]) return map[q];
  const norm = q.trim().toLowerCase();
  for (const k of Object.keys(map)) {
    if (k.trim().toLowerCase() === norm) return map[k];
  }
  return null;
}

function trendOf(first: number | null, latest: number | null): Trend {
  if (first == null || latest == null) return "flat";
  const d = first - latest; // >0 => позиция улучшилась
  if (d > 0.3) return "up";
  if (d < -0.3) return "down";
  return "flat";
}

function buildAnchorEngine(
  snaps: Snapshot[],
  engine: "yandex" | "google",
  q: string
): AnchorEngine | null {
  const series: SparkPoint[] = snaps.map((s) => {
    const stat = findStat(engineMap(s, engine), q);
    const pos = stat && typeof stat.position === "number" ? stat.position : null;
    return { date: s.date, pos };
  });
  const withVals = series.filter((p) => p.pos != null);
  if (withVals.length === 0) return null;
  const latest = withVals[withVals.length - 1].pos;
  const first = withVals[0].pos;
  const delta = first != null && latest != null ? +(first - latest).toFixed(2) : null;
  return { series, latest, first, trend: trendOf(first, latest), delta };
}

function buildReputation(
  site: SiteKey,
  reps: RawReputationFile[]
): ReputationItem[] {
  if (reps.length === 0) return [];
  const latest = reps[reps.length - 1];
  const past = reps.length > COMPARE_LAG ? reps[reps.length - 1 - COMPARE_LAG] : reps[0];
  const out: ReputationItem[] = [];
  for (const { key, label } of REPUTATION_MAP[site]) {
    const cur = latest[key];
    if (!cur || typeof cur !== "object") continue; // нет карточки в данных — не показываем «0★»
    const prv = past[key];
    const prvOk = prv && typeof prv === "object";
    const rating = (cur as { rating: number }).rating;
    const reviews = (cur as { reviews: number }).reviews;
    out.push({
      key,
      label,
      rating,
      reviews,
      dRating: prvOk ? +(rating - (prv as { rating: number }).rating).toFixed(1) : null,
      dReviews: prvOk ? reviews - (prv as { reviews: number }).reviews : null,
    });
  }
  return out;
}

function buildSources(latest: Snapshot): SourceStatus[] {
  const engines: ("yandex" | "google" | "bing")[] = ["yandex", "google", "bing"];
  return engines.map((engine) => {
    const raw = latest[engine];
    if (raw && typeof raw === "object" && "error" in raw) {
      return {
        engine,
        status: "error" as const,
        clicks7d: 0,
        queries: 0,
        inTop10: 0,
        error: String((raw as { error: string }).error).slice(0, 160),
      };
    }
    const map = engineMap(latest, engine) || {};
    const entries = Object.values(map);
    const clicks7d = entries.reduce((a, s) => a + (s.clicks || 0), 0);
    const inTop10 = entries.filter((s) => typeof s.position === "number" && s.position! <= 10).length;
    return {
      engine,
      status: "live" as const,
      clicks7d,
      queries: entries.length,
      inTop10,
    };
  });
}

function buildClicksSeries(snaps: Snapshot[]) {
  return snaps.map((s) => {
    const ym = engineMap(s, "yandex");
    const gm = engineMap(s, "google");
    const sum = (m: Record<string, QueryStat> | null) =>
      m ? Object.values(m).reduce((a, x) => a + (x.clicks || 0), 0) : 0;
    return { date: s.date, yandex: sum(ym), google: sum(gm) };
  });
}

export function buildOverview(site: SiteKey): Overview {
  const snaps = readSnapshotRange(site, WINDOW);
  if (snaps.length === 0) {
    return MOCK_OVERVIEWS[site];
  }
  const latest = snaps[snaps.length - 1];
  const past = snaps.length > COMPARE_LAG ? snaps[snaps.length - 1 - COMPARE_LAG] : snaps[0];

  // Anchors
  const anchors: Anchor[] = ANCHORS[site].map((def) => {
    const engines: Anchor["engines"] = {};
    for (const e of def.engines) {
      const ae = buildAnchorEngine(snaps, e, def.q);
      if (ae) engines[e] = ae;
    }
    return {
      q: def.q,
      url: def.url,
      goalPos: def.goalPos,
      priority: def.priority,
      engines,
    };
  });

  const sources = buildSources(latest);
  const reputation = buildReputation(site, readReputationRange(WINDOW));
  const clicksSeries = buildClicksSeries(snaps);

  // Score inputs — latest & lagged anchor positions across engines.
  const flat = (snap: Snapshot): (number | null)[] => {
    const out: (number | null)[] = [];
    for (const def of ANCHORS[site]) {
      for (const e of def.engines) {
        const st = findStat(engineMap(snap, e), def.q);
        out.push(st && typeof st.position === "number" ? st.position : null);
      }
    }
    return out;
  };
  const sourcesAlive = sources.filter((s) => s.status === "live").length;
  const score = computeScore({
    anchorPositions: flat(latest),
    anchorPositionsPast: flat(past),
    sourcesAlive,
    sourcesTotal: sources.length,
  });

  const advice = buildAdvice({ site: SITES[site], anchors, sources, reputation, clicksSeries, score });

  return {
    site: SITES[site],
    date: latest.date,
    mock: false,
    score,
    advice,
    anchors,
    sources,
    reputation,
    clicksSeries,
  };
}
