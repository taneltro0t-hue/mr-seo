import type { SiteKey, SiteMeta } from "./types";

// Site registry. Anchor (primary VCH) queries mirror carpathy/targets.json.
// Brand indicators are tracked separately and NOT counted as VCH goals.

export const SITES: Record<SiteKey, SiteMeta> = {
  mysite: {
    key: "mysite",
    label: "Low Light",
    domain: "example.com",
    kind: "Студия звукозаписи",
    region: "Столица · Город",
    accent: "#8b93ff",
  },
  demo2: {
    key: "demo2",
    label: "Демо-бренд",
    domain: "example.org",
    kind: "Клуб",
    region: "Город",
    accent: "#ff6b8b",
  },
  demo3: {
    key: "demo3",
    label: "РЦ Основа",
    domain: "demo3-stavropol.ru",
    kind: "Реабилитационный центр",
    region: "Город-2",
    accent: "#38e8d0",
  },
};

export const SITE_ORDER: SiteKey[] = ["mysite", "demo2", "demo3"];

export interface AnchorDef {
  q: string;
  url: string;
  goalPos: number;
  priority: string;
  engines: ("yandex" | "google")[];
}

// Primary VCH targets (from targets.json). We track both engines for each.
export const ANCHORS: Record<SiteKey, AnchorDef[]> = {
  mysite: [
    { q: "студия звукозаписи город", url: "/volgograd", goalPos: 1, priority: "P0", engines: ["yandex", "google"] },
    { q: "студия звукозаписи столица", url: "/moscow", goalPos: 3, priority: "P0", engines: ["yandex", "google"] },
    { q: "заказать съемку клипа в столица", url: "/moscow", goalPos: 10, priority: "P1", engines: ["yandex", "google"] },
  ],
  demo2: [
    { q: "пример запроса", url: "/", goalPos: 1, priority: "P0", engines: ["yandex", "google"] },
    { q: "мужской клуб город", url: "/", goalPos: 3, priority: "P1", engines: ["yandex", "google"] },
    { q: "пример запроса", url: "/", goalPos: 3, priority: "P1", engines: ["yandex", "google"] },
  ],
  demo3: [
    { q: "лечение наркомании город-2", url: "/lechenie/narkomaniya", goalPos: 1, priority: "P0", engines: ["yandex", "google"] },
    { q: "реабилитационный центр город-2", url: "/", goalPos: 1, priority: "P0", engines: ["yandex", "google"] },
    { q: "лечение алкоголизма город-2", url: "/lechenie/alkogolizm", goalPos: 1, priority: "P0", engines: ["yandex", "google"] },
  ],
};

// Reputation keys belonging to each site (reputation file is global).
export const REPUTATION_MAP: Record<SiteKey, { key: string; label: string }[]> = {
  mysite: [
    { key: "mysite_point", label: "Я.Карты · Столица" },
    { key: "mysite_point", label: "Я.Карты · Город" },
  ],
  demo2: [{ key: "demo2", label: "Я.Карты · Город" }],
  demo3: [{ key: "demo3", label: "Я.Карты · Город-2" }],
};

export function isSiteKey(v: string | null | undefined): v is SiteKey {
  return v === "mysite" || v === "demo2" || v === "demo3";
}
