import type { SiteKey } from "./types";

/**
 * Deep-links в кабинеты экосистемы для экрана «Пульт».
 * Источник карты — ECOSYSTEM_TOOLS.md (§2). Ссылки помеченные там 🟡/⚠️
 * выводятся «как есть» по конвенции (host_id-паттерн надёжен, точные слаги
 * разделов не кликнуты под логином — помечено полем `unverified`).
 *
 * host_id Вебмастера = `https:{host}:443`. GSC resource = `sc-domain:{host}`.
 * counter_id Метрики — из sites_config.py (source of truth), не секрет.
 */

export interface CabinetLink {
  label: string;
  href: string;
  /** true — путь по конвенции, не подтверждён кликом (см. ECOSYSTEM_TOOLS §4). */
  unverified?: boolean;
}

export interface CabinetGroup {
  service: "webmaster" | "gsc" | "sprav" | "metrika" | "bing";
  title: string;
  links: CabinetLink[];
  /** пусто → честный плейсхолдер «ещё не заведено». */
  emptyNote?: string;
}

interface SiteCabinet {
  /** host_id Вебмастера — `https:{host}:443`. */
  yandexHostId: string;
  /** GSC resource_id (domain property). */
  gscResource: string;
  /** counter_id Метрики (sites_config.py). null → ссылка на список. */
  metrikaCounter: string | null;
  /** id карточек Я.Бизнеса. Пусто → без ссылки. */
  spravIds: { id: string; label: string }[];
}

const CABINETS: Record<SiteKey, SiteCabinet> = {
  mysite: {
    yandexHostId: "https:example.com:443",
    gscResource: "sc-domain:example.com",
    metrikaCounter: "108452479",
    spravIds: [
      { id: "000000000", label: "Столица" },
      { id: "000000000", label: "Город" },
    ],
  },
  demo2: {
    yandexHostId: "https:example.org:443",
    gscResource: "sc-domain:example.org",
    metrikaCounter: "107717978",
    spravIds: [],
  },
  demo3: {
    yandexHostId: "https:example.net:443",
    gscResource: "sc-domain:example.net",
    metrikaCounter: "110047189",
    spravIds: [],
  },
};

/** Собрать все группы deep-links для сайта. */
export function cabinetGroups(site: SiteKey): CabinetGroup[] {
  const c = CABINETS[site];
  const wm = `https://webmaster.yandex.ru/site/${c.yandexHostId}`;
  const gsc = (path: string) =>
    `https://search.google.com/search-console${path}?resource_id=${encodeURIComponent(c.gscResource)}`;

  const groups: CabinetGroup[] = [
    {
      service: "webmaster",
      title: "Яндекс.Вебмастер",
      links: [
        { label: "Сводка хоста", href: `${wm}/dashboard/`, unverified: true },
        { label: "Видимость в Алисе AI", href: `${wm}/efficiency/alice/` },
        { label: "Переобход страниц", href: `${wm}/indexing/reindex/` },
      ],
    },
    {
      service: "gsc",
      title: "Search Console",
      links: [
        { label: "Обзор ресурса", href: gsc("") },
        { label: "Эффективность", href: gsc("/performance/search-analytics"), unverified: true },
        { label: "Индексирование", href: gsc("/index"), unverified: true },
      ],
    },
  ];

  // Я.Бизнес — только для сайтов с известными id карточек.
  if (c.spravIds.length > 0) {
    groups.push({
      service: "sprav",
      title: "Яндекс.Бизнес",
      links: c.spravIds.map((s) => ({
        label: s.label,
        href: `https://yandex.ru/sprav/${s.id}/p/edit/main`,
      })),
    });
  } else {
    groups.push({
      service: "sprav",
      title: "Яндекс.Бизнес",
      links: [{ label: "Список карточек", href: "https://yandex.ru/sprav/companies" }],
      emptyNote: "id карточки для этого сайта не заведён",
    });
  }

  // Метрика — прямой дашборд по counter_id, иначе список.
  groups.push(
    c.metrikaCounter
      ? {
          service: "metrika",
          title: "Яндекс.Метрика",
          links: [
            {
              label: `Дашборд · ${c.metrikaCounter}`,
              href: `https://metrika.yandex.ru/dashboard?id=${c.metrikaCounter}`,
              unverified: true,
            },
          ],
        }
      : {
          service: "metrika",
          title: "Яндекс.Метрика",
          links: [{ label: "Список счётчиков", href: "https://metrika.yandex.ru/list" }],
          emptyNote: "counter_id не задан",
        }
  );

  return groups;
}
