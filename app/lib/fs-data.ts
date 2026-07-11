import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Snapshot, SiteKey } from "./types";

// Root of the live SEO agent data. Overridable via env for portability.
export const SEO_ROOT =
  process.env.SEO_AGENT_ROOT || "";

function safeRead(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function safeJson<T>(p: string): T | null {
  const raw = safeRead(p);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function listDatedJson(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort();
  } catch {
    return [];
  }
}

/** Last `days` snapshots for a site, oldest → newest. Empty if unavailable. */
export function readSnapshotRange(site: SiteKey, days: number): Snapshot[] {
  const dir = path.join(SEO_ROOT, "memory", site, "daily_snapshots");
  const files = listDatedJson(dir).slice(-days);
  const out: Snapshot[] = [];
  for (const f of files) {
    const s = safeJson<Snapshot>(path.join(dir, f));
    if (s) out.push({ ...s, date: s.date || f.replace(".json", "") });
  }
  return out;
}

export interface RawReputationFile {
  date: string;
  [k: string]: { rating: number; reviews: number } | string;
}

/** Last `days` reputation files, oldest → newest. */
export function readReputationRange(days: number): RawReputationFile[] {
  const dir = path.join(SEO_ROOT, "memory", "reputation");
  const files = listDatedJson(dir).slice(-days);
  const out: RawReputationFile[] = [];
  for (const f of files) {
    const r = safeJson<RawReputationFile>(path.join(dir, f));
    if (r) out.push({ ...r, date: r.date || f.replace(".json", "") });
  }
  return out;
}

export function readHypothesesRaw(): unknown | null {
  return safeJson(path.join(SEO_ROOT, "carpathy", "hypotheses.json"));
}

export function readGraveyardRaw(): string | null {
  return safeRead(path.join(SEO_ROOT, "carpathy", "graveyard.md"));
}

export interface RawRun {
  slug: string;
  markdown: string;
}

export function readRunsRaw(limit = 30): RawRun[] {
  const dir = path.join(SEO_ROOT, "swarm", "runs");
  let files: string[] = [];
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, limit);
  } catch {
    return [];
  }
  const out: RawRun[] = [];
  for (const f of files) {
    const md = safeRead(path.join(dir, f));
    if (md) out.push({ slug: f.replace(/\.md$/, ""), markdown: md });
  }
  return out;
}

/* ------------------------- AI visibility (LLM) ------------------------- */

export interface RawAiVisResult {
  query: string;
  brand: string;
  city?: string;
  brand_mentioned: boolean;
  our_domain_cited: string[];
  competitors_cited: string[];
  snippet?: string;
}

export interface RawAiVisFile {
  week?: string;
  ran_at?: string;
  results: RawAiVisResult[];
}

/** Самый свежий недельный замер LLM-видимости (research/ai_visibility/*.json). */
export function readAiVisibilityLatest(): RawAiVisFile | null {
  const dir = path.join(SEO_ROOT, "research", "ai_visibility");
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  return safeJson<RawAiVisFile>(path.join(dir, files[files.length - 1]));
}

/* ------------------------- Query analytics (Yandex) ------------------------- */

export interface RawQueryStat {
  url: string;
  position: number;
  clicks: number;
  ctr: number;
  impressions: number;
  demand: number;
  last_date: string;
  position_series: Record<string, number>;
}

export type RawQueryAnalytics = Record<string, RawQueryStat>;

/** Последний файл детальной аналитики запросов для сайта. */
export function readQueryAnalyticsLatest(site: SiteKey): RawQueryAnalytics | null {
  const dir = path.join(SEO_ROOT, "memory", site, "query_analytics");
  const files = listDatedJson(dir);
  if (files.length === 0) return null;
  return safeJson<RawQueryAnalytics>(path.join(dir, files[files.length - 1]));
}

/* ------------------------- SERP (independent check) ------------------------- */

export interface RawSerpFile {
  date: string;
  engine: string;
  sites: Record<string, Record<string, { pos: number | null; top5: string[] }>>;
}

/** Последняя независимая проверка выдачи (memory/serp/*.json). */
export function readSerpLatest(): RawSerpFile | null {
  const dir = path.join(SEO_ROOT, "memory", "serp");
  const files = listDatedJson(dir);
  if (files.length === 0) return null;
  const last = files[files.length - 1];
  const parsed = safeJson<RawSerpFile>(path.join(dir, last));
  if (parsed && !parsed.date) parsed.date = last.replace(".json", "");
  return parsed;
}

export function dataRootExists(): boolean {
  try {
    return fs.existsSync(path.join(SEO_ROOT, "memory"));
  } catch {
    return false;
  }
}
