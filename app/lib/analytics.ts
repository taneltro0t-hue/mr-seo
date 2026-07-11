import "server-only";
import type { AiVisibility, Analytics, SerpBlock, SiteKey, YandexQueryRow } from "./types";
import { SITES } from "./sites";
import {
  readAiVisibilityLatest,
  readQueryAnalyticsLatest,
  readSerpLatest,
} from "./fs-data";

function buildAi(site: SiteKey): AiVisibility | null {
  const file = readAiVisibilityLatest();
  if (!file) return null;
  const mine = file.results.filter((r) => r.brand === site);
  if (mine.length === 0) return null;

  const competitorCount = new Map<string, number>();
  for (const r of mine) {
    for (const d of r.competitors_cited) {
      competitorCount.set(d, (competitorCount.get(d) ?? 0) + 1);
    }
  }
  const competitors = [...competitorCount.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    week: file.week ?? null,
    ranAt: file.ran_at ?? null,
    total: mine.length,
    mentioned: mine.filter((r) => r.brand_mentioned).length,
    queries: mine.map((r) => ({
      query: r.query,
      city: r.city ?? null,
      mentioned: r.brand_mentioned,
      ourCited: r.our_domain_cited ?? [],
      competitors: r.competitors_cited ?? [],
    })),
    competitors,
  };
}

function buildYandex(site: SiteKey): YandexQueryRow[] {
  const qa = readQueryAnalyticsLatest(site);
  if (!qa) return [];
  return Object.entries(qa)
    .map(([q, v]) => {
      const dates = Object.keys(v.position_series ?? {}).sort();
      const series = dates.map((d) => {
        const p = v.position_series[d];
        return typeof p === "number" && p > 0 ? p : null;
      });
      return {
        q,
        url: v.url,
        position: v.position,
        ctr: v.ctr,
        clicks: v.clicks,
        impressions: v.impressions,
        demand: v.demand,
        series,
      };
    })
    .sort((a, b) => b.demand - a.demand || a.position - b.position)
    .slice(0, 10);
}

function buildSerp(site: SiteKey): SerpBlock | null {
  const file = readSerpLatest();
  if (!file) return null;
  const block = file.sites?.[site];
  if (!block) return null;
  const rows = Object.entries(block).map(([q, v]) => ({
    q,
    pos: v.pos ?? null,
    top5: v.top5 ?? [],
  }));
  if (rows.length === 0) return null;
  return { date: file.date ?? null, engine: file.engine ?? "ddg/bing", rows };
}

export function buildAnalytics(site: SiteKey): Analytics {
  return {
    site: SITES[site],
    ai: buildAi(site),
    yandex: buildYandex(site),
    serp: buildSerp(site),
  };
}
