import type { Anchor, Overview, ReputationItem, SiteKey, SourceStatus, SparkPoint, Trend } from "./types";
import { SITES } from "./sites";
import { computeScore } from "./score";
import { buildAdvice } from "./advice";

// Реалистичный фолбэк на случай, если диск SEO-агента недоступен.
// Числа — из реального прогона Аналитика 2026-07-05 (не lorem).

const DATES = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"];

function series(vals: (number | null)[]): SparkPoint[] {
  return DATES.map((date, i) => ({ date, pos: vals[i] ?? null }));
}
function trendOf(s: SparkPoint[]): Trend {
  const v = s.filter((p) => p.pos != null);
  if (v.length < 2) return "flat";
  const d = (v[0].pos as number) - (v[v.length - 1].pos as number);
  return d > 0.3 ? "up" : d < -0.3 ? "down" : "flat";
}
function engine(vals: (number | null)[]) {
  const s = series(vals);
  const withV = s.filter((p) => p.pos != null);
  const latest = withV.length ? withV[withV.length - 1].pos : null;
  const first = withV.length ? withV[0].pos : null;
  return {
    series: s,
    latest,
    first,
    trend: trendOf(s),
    delta: first != null && latest != null ? +(first - latest).toFixed(2) : null,
  };
}

interface Seed {
  anchors: Anchor[];
  sources: SourceStatus[];
  reputation: ReputationItem[];
  clicks: [number, number][]; // [yandex, google] per day
}

const SEEDS: Record<SiteKey, Seed> = {
  mysite: {
    anchors: [
      {
        q: "студия звукозаписи город",
        url: "/volgograd",
        goalPos: 1,
        priority: "P0",
        engines: { yandex: engine([8.5, 8.5, 10.5, 7.6, 7.6]), google: engine([5.5, 3, 3, 5.5, 5.5]) },
      },
      {
        q: "студия звукозаписи столица",
        url: "/moscow",
        goalPos: 3,
        priority: "P0",
        engines: {},
      },
      {
        q: "заказать съемку клипа в столица",
        url: "/moscow",
        goalPos: 10,
        priority: "P1",
        engines: { yandex: engine([10.37, 10.44, 10.85, 10.94, 11.32]) },
      },
    ],
    sources: [
      { engine: "yandex", status: "live", clicks7d: 7, queries: 98, inTop10: 12 },
      { engine: "google", status: "live", clicks7d: 0, queries: 41, inTop10: 2 },
      { engine: "bing", status: "error", clicks7d: 0, queries: 0, inTop10: 0, error: "HTTPSConnectionPool(host='ssl.bing.com', port=443): Max retries exceeded" },
    ],
    reputation: [
      { key: "mysite_point", label: "Я.Карты · Столица", rating: 4.8, reviews: 18, dRating: 0, dReviews: 0 },
      { key: "mysite_point", label: "Я.Карты · Город", rating: 4.9, reviews: 23, dRating: 0, dReviews: 1 },
    ],
    clicks: [[8, 1], [12, 0], [8, 1], [12, 0], [7, 0]],
  },
  demo2: {
    anchors: [
      {
        q: "пример запроса",
        url: "/",
        goalPos: 1,
        priority: "P0",
        engines: { yandex: engine([5.94, 5.83, 6.06, 6.24, 6.46]), google: engine([4.47, 4, 4, 4, 4]) },
      },
      {
        q: "мужской клуб город",
        url: "/",
        goalPos: 3,
        priority: "P1",
        engines: { yandex: engine([3.2, 3.1, 3.0, 2.9, 2.8]) },
      },
      {
        q: "пример запроса",
        url: "/",
        goalPos: 3,
        priority: "P1",
        engines: { yandex: engine([2.4, 2.3, 2.2, 2.2, 2.1]), google: engine([3, 3, 2, 2, 2]) },
      },
    ],
    sources: [
      { engine: "yandex", status: "live", clicks7d: 35, queries: 120, inTop10: 23 },
      { engine: "google", status: "live", clicks7d: 3, queries: 74, inTop10: 13 },
      { engine: "bing", status: "live", clicks7d: 0, queries: 2, inTop10: 0 },
    ],
    reputation: [{ key: "demo2", label: "Я.Карты · Город", rating: 4.7, reviews: 55, dRating: 0, dReviews: 2 }],
    clicks: [[31, 4], [33, 4], [34, 4], [35, 4], [35, 3]],
  },
  demo3: {
    anchors: [
      {
        q: "лечение наркомании город-2",
        url: "/lechenie/narkomaniya",
        goalPos: 1,
        priority: "P0",
        engines: { google: engine([12, 11, 9, 8, 8]) },
      },
      {
        q: "реабилитационный центр город-2",
        url: "/",
        goalPos: 1,
        priority: "P0",
        engines: { yandex: engine([14, 13, 12, 11, 10]) },
      },
      {
        q: "лечение алкоголизма город-2",
        url: "/lechenie/alkogolizm",
        goalPos: 1,
        priority: "P0",
        engines: {},
      },
    ],
    sources: [
      { engine: "yandex", status: "live", clicks7d: 5, queries: 48, inTop10: 3 },
      { engine: "google", status: "live", clicks7d: 0, queries: 4, inTop10: 0 },
      { engine: "bing", status: "error", clicks7d: 0, queries: 0, inTop10: 0, error: "no data" },
    ],
    reputation: [{ key: "demo3", label: "Я.Карты · Город-2", rating: 4.6, reviews: 12, dRating: 0.1, dReviews: 1 }],
    clicks: [[2, 0], [3, 0], [2, 0], [5, 0], [5, 0]],
  },
};

function build(site: SiteKey): Overview {
  const seed = SEEDS[site];
  const flat: (number | null)[] = [];
  const flatPast: (number | null)[] = [];
  for (const a of seed.anchors) {
    for (const e of ["yandex", "google"] as const) {
      const ae = a.engines[e];
      flat.push(ae?.latest ?? null);
      flatPast.push(ae?.first ?? null);
    }
  }
  const sourcesAlive = seed.sources.filter((s) => s.status === "live").length;
  const score = computeScore({
    anchorPositions: flat,
    anchorPositionsPast: flatPast,
    sourcesAlive,
    sourcesTotal: seed.sources.length,
  });
  const clicksSeries = DATES.map((date, i) => ({ date, yandex: seed.clicks[i][0], google: seed.clicks[i][1] }));
  const advice = buildAdvice({
    site: SITES[site],
    anchors: seed.anchors,
    sources: seed.sources,
    reputation: seed.reputation,
    clicksSeries,
    score,
  });
  return {
    site: SITES[site],
    date: DATES[DATES.length - 1],
    mock: true,
    score,
    advice,
    anchors: seed.anchors,
    sources: seed.sources,
    reputation: seed.reputation,
    clicksSeries,
  };
}

export const MOCK_OVERVIEWS: Record<SiteKey, Overview> = {
  mysite: build("mysite"),
  demo2: build("demo2"),
  demo3: build("demo3"),
};
