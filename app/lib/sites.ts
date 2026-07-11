import type { SiteKey, SiteMeta } from "./types";

// Site registry. Anchor (primary VCH) queries mirror carpathy/targets.json.
// Brand indicators are tracked separately and NOT counted as VCH goals.

export const SITES: Record<SiteKey, SiteMeta> = {
  // Пример. Добавьте свои сайты по этому образцу (ключ = site_key везде в системе).
  mysite: {
    label: "Мой сайт",
    sub: "Город · направление",
    domain: "example.com",
    accent: "#8b93ff",
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
    { q: "пример услуги город", url: "/volgograd", goalPos: 1, priority: "P0", engines: ["yandex", "google"] },
    { q: "пример услуги город", url: "/moscow", goalPos: 3, priority: "P0", engines: ["yandex", "google"] },
    { q: "заказать съемку клипа в москве", url: "/moscow", goalPos: 10, priority: "P1", engines: ["yandex", "google"] },
  ],
  demo2: [
    { q: "пример запроса 1", url: "/", goalPos: 1, priority: "P0", engines: ["yandex", "google"] },
    { q: "пример запроса 3", url: "/", goalPos: 3, priority: "P1", engines: ["yandex", "google"] },
    { q: "пример запроса 2", url: "/", goalPos: 3, priority: "P1", engines: ["yandex", "google"] },
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
    { key: "mysite_moscow", label: "Я.Карты · Город" },
    { key: "mysite_volgograd", label: "Я.Карты · Город" },
  ],
  demo2: [{ key: "demo2", label: "Я.Карты · Город" }],
  demo3: [{ key: "demo3", label: "Я.Карты · Город-2" }],
};

export function isSiteKey(v: string | null | undefined): v is SiteKey {
  return v === "mysite" || v === "demo2" || v === "demo3";
}
