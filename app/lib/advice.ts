import type {
  Advice,
  Anchor,
  Overview,
  Priority,
  ReputationItem,
  Score,
  SiteMeta,
  SourceStatus,
} from "./types";

const ENGINE_LABEL: Record<string, string> = { yandex: "Яндекс", google: "Google", bing: "Bing" };

interface AdviceInput {
  site: SiteMeta;
  anchors: Anchor[];
  sources: SourceStatus[];
  reputation: ReputationItem[];
  clicksSeries: Overview["clicksSeries"];
  score: Score;
}

const PRIO_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/**
 * «Что делать» — сердце продукта. Превращаем данные в 1-3 совета
 * человеческим языком. Никаких агрегатных «падений» Яндекса — только
 * якорные позиции, живость источников и репутация.
 */
export function buildAdvice(input: AdviceInput): Advice[] {
  const { anchors, sources, reputation, clicksSeries } = input;
  const out: Advice[] = [];

  // Лучший (по позиции) движок для якоря.
  const bestEngine = (a: Anchor) => {
    const cands = (["yandex", "google"] as const)
      .map((e) => ({ e, ae: a.engines[e] }))
      .filter((x) => x.ae && x.ae.latest != null);
    if (cands.length === 0) return null;
    cands.sort((x, y) => (x.ae!.latest as number) - (y.ae!.latest as number));
    return cands[0];
  };

  // 1) Проседающие P0-якоря.
  for (const a of anchors) {
    const be = bestEngine(a);
    if (!be || !be.ae) continue;
    if (a.priority === "P0" && be.ae.trend === "down" && be.ae.delta != null) {
      out.push({
        id: `drop-${a.q}`,
        priority: "high",
        tone: "warn",
        tag: "Позиции",
        title: `«${a.q}» проседает`,
        body: `За окно позиция в ${ENGINE_LABEL[be.e]} сдвинулась на ${Math.abs(be.ae.delta).toFixed(1)} вниз (сейчас ${be.ae.latest?.toFixed(1)}). Это целевой запрос — усильте страницу ${a.url}: свежесть контента, внутренние ссылки, отзывы.`,
      });
    }
  }

  // 2) P0-якоря вне топ-10 совсем.
  for (const a of anchors) {
    const be = bestEngine(a);
    const outOfTop = !be || (be.ae && (be.ae.latest == null || be.ae.latest > 10));
    if (a.priority === "P0" && outOfTop) {
      out.push({
        id: `outoftop-${a.q}`,
        priority: "high",
        tone: "warn",
        tag: "Рост",
        title: `«${a.q}» пока вне топ-10`,
        body: be && be.ae?.latest != null
          ? `Позиция ${be.ae.latest.toFixed(0)} в ${ENGINE_LABEL[be.e]}. Чтобы зайти на первую страницу, нужен внешний вес: 2ГИС/Zoon, отзывы, беклинки — on-page уже сделан.`
          : `Запрос не показывается в выдаче. Нужны внешние сигналы на ${a.url}: локальные карточки, отзывы, ссылки.`,
      });
    }
  }

  // 3) Источник молчит.
  for (const s of sources) {
    if (s.status === "error") {
      out.push({
        id: `src-${s.engine}`,
        priority: s.engine === "bing" ? "low" : "medium",
        tone: s.engine === "bing" ? "ok" : "warn",
        tag: "Источник",
        title: `${ENGINE_LABEL[s.engine]} не отвечает`,
        body: `Сканер не получил данные из ${ENGINE_LABEL[s.engine]} в последнем прогоне. Пока источник молчит, метрики по нему не обновляются — проверьте ключ API/доступ.`,
      });
    }
  }

  // 4) Google без переходов, но выдача жива.
  const g = sources.find((s) => s.engine === "google");
  if (g && g.status === "live" && g.clicks7d === 0 && g.queries > 0) {
    out.push({
      id: "google-noclicks",
      priority: "medium",
      tone: "ok",
      tag: "Клики",
      title: "Google показывает, но не приводит",
      body: `${g.queries} запросов в выдаче Google, но 0 переходов за окно. Показы есть — не хватает кликабельности: перепишите title/description под топовые запросы страницы.`,
    });
  }

  // 5) Репутация растёт — позитив.
  const grew = reputation.find((r) => r.dReviews != null && r.dReviews > 0);
  if (grew) {
    out.push({
      id: `rep-${grew.key}`,
      priority: "low",
      tone: "good",
      tag: "Репутация",
      title: "Отзывы прибавляют",
      body: `${grew.label}: +${grew.dReviews} отзыв(а) за неделю, рейтинг ${grew.rating.toFixed(1)}★. Держите темп 2-3 отзыва в неделю — ровный поток укрепляет топ и не выглядит накруткой.`,
    });
  }

  // 6) Якорь в топ-3 — удержание.
  for (const a of anchors) {
    const be = bestEngine(a);
    if (be && be.ae?.latest != null && be.ae.latest <= 3) {
      out.push({
        id: `hold-${a.q}`,
        priority: "low",
        tone: "good",
        tag: "Удержание",
        title: `Топ-3 по «${a.q}»`,
        body: `Позиция ${be.ae.latest.toFixed(1)} в ${ENGINE_LABEL[be.e]}. Не трогайте страницу без нужды — растёт сама. Точечно: свежесть dateModified и приток отзывов.`,
      });
      break;
    }
  }

  // Фолбэк, чтобы карточка «Что делать» не была пустой.
  if (out.length === 0) {
    out.push({
      id: "steady",
      priority: "low",
      tone: "good",
      tag: "Статус",
      title: "Всё под контролем",
      body: "Резких движений по якорным запросам нет. Продолжайте текущий контент-план и следите за притоком отзывов.",
    });
  }

  out.sort((a, b) => PRIO_RANK[a.priority] - PRIO_RANK[b.priority]);
  return out.slice(0, 3);
}
