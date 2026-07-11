import "server-only";
import type {
  DataNode,
  Engine,
  NodeState,
  NodesResponse,
  QueryStat,
  SiteKey,
  Snapshot,
} from "./types";
import { REPUTATION_MAP, SITES, SITE_ORDER } from "./sites";
import {
  readAiVisibilityLatest,
  readReputationRange,
  readSnapshotRange,
  type RawReputationFile,
} from "./fs-data";

const ENGINE_META: Record<Engine, { label: string; sub: string; fix: string }> = {
  yandex: {
    label: "Яндекс.Вебмастер",
    sub: "Позиции и запросы",
    fix: "Обновите OAuth-токен Яндекс.Вебмастера — обычно он просто истёк.",
  },
  google: {
    label: "Google Search Console",
    sub: "Сервисный аккаунт",
    fix: "Проверьте, что сервисный аккаунт добавлен пользователем в Search Console.",
  },
  bing: {
    label: "Bing Webmaster",
    sub: "Резервный источник",
    fix: "Проверьте API-ключ Bing Webmaster в настройках сканера.",
  },
};

function engineNode(
  site: SiteKey,
  snap: Snapshot | null,
  engine: Engine,
  lastDate: string | null
): DataNode {
  const meta = ENGINE_META[engine];
  const base = { site, kind: engine, label: meta.label, sub: meta.sub, lastDate };

  if (!snap) {
    return {
      ...base,
      state: "idle" as NodeState,
      metric: null,
      detail: "Источник ещё не подключён — данных нет.",
      fix: meta.fix,
    };
  }

  const raw = snap[engine];
  if (raw && typeof raw === "object" && "error" in raw) {
    return {
      ...base,
      state: "error",
      metric: null,
      detail: `Источник молчит: ${String((raw as { error: string }).error).slice(0, 120)}`,
      fix: meta.fix,
    };
  }

  const map = (raw && typeof raw === "object" ? raw : {}) as Record<string, QueryStat>;
  const entries = Object.values(map);
  const inTop10 = entries.filter(
    (s) => typeof s.position === "number" && s.position <= 10
  ).length;
  return {
    ...base,
    state: "live",
    metric: `${entries.length} запросов`,
    detail: `Данные поступают · ${inTop10} в топ-10. Последний скан ${lastDate ?? "—"}.`,
  };
}

function reputationNode(
  site: SiteKey,
  rep: RawReputationFile | null,
  lastDate: string | null
): DataNode {
  const base = {
    site,
    kind: "reputation" as const,
    label: "Яндекс.Карты",
    sub: "Репутация · отзывы",
    lastDate,
  };
  const keys = REPUTATION_MAP[site] ?? [];
  const found = rep
    ? keys
        .map((k) => ({ ...k, v: rep[k.key] }))
        .filter((x) => x.v && typeof x.v === "object")
    : [];
  if (found.length === 0) {
    return {
      ...base,
      state: "idle",
      metric: null,
      detail: "Карточка на Я.Картах ещё не привязана к рою.",
      fix: "Укажите ссылку на организацию в Я.Картах — начнём отслеживать рейтинг и отзывы.",
    };
  }
  const totalReviews = found.reduce(
    (a, x) => a + (x.v as { reviews: number }).reviews,
    0
  );
  const avg =
    found.reduce((a, x) => a + (x.v as { rating: number }).rating, 0) / found.length;
  return {
    ...base,
    state: "live",
    metric: `${avg.toFixed(1)}★`,
    detail: `${found.length > 1 ? found.length + " карточки · " : ""}${totalReviews} отзывов на ${lastDate ?? "сегодня"}.`,
  };
}

function llmNode(
  site: SiteKey,
  ai: ReturnType<typeof readAiVisibilityLatest>
): DataNode {
  const base = {
    site,
    kind: "llm" as const,
    label: "LLM-мониторинг",
    sub: "Нейросети про вас",
    lastDate: ai?.week ?? null,
  };
  const mine = ai?.results.filter((r) => r.brand === site) ?? [];
  if (mine.length === 0) {
    return {
      ...base,
      state: "idle",
      metric: null,
      detail: "Сайт ещё не в списке недельного замера нейросетей.",
      fix: "Добавим запросы бренда в еженедельный прогон LLM-видимости.",
    };
  }
  const mentioned = mine.filter((r) => r.brand_mentioned).length;
  return {
    ...base,
    state: "live",
    metric: `${mentioned}/${mine.length}`,
    detail: `Нейросети упомянули бренд в ${mentioned} из ${mine.length} ответов. Замер ${ai?.week ?? ""}.`,
  };
}

export function buildNodes(): NodesResponse {
  const reps = readReputationRange(1);
  const repLatest = reps.length ? reps[reps.length - 1] : null;
  const ai = readAiVisibilityLatest();

  const groups = SITE_ORDER.map((site) => {
    const snaps = readSnapshotRange(site, 1);
    const snap = snaps.length ? snaps[snaps.length - 1] : null;
    const snapDate = snap?.date ?? null;
    const nodes: DataNode[] = [
      engineNode(site, snap, "yandex", snapDate),
      engineNode(site, snap, "google", snapDate),
      engineNode(site, snap, "bing", snapDate),
      reputationNode(site, repLatest, repLatest?.date ?? null),
      llmNode(site, ai),
    ];
    return { site: SITES[site], nodes };
  });

  return { mock: false, groups };
}
