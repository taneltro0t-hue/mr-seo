import type { Score, Tone } from "./types";

/**
 * Health score 0..100 for a site.
 *
 * ЧЕРНОВАЯ ФОРМУЛА — намеренно простая и прозрачная. Антон докрутит.
 * Считается из трёх наблюдаемых сигналов (как в брифе):
 *   1. Доля якорных ВЧ-запросов в топ-10  (вес 0.50) — главный сигнал качества.
 *   2. Тренд кликов по якорям за окно       (вес 0.20) — растём/падаем.
 *   3. Живость источников (Я/G/Bing)         (вес 0.30) — если сканер слеп,
 *      доверять данным нельзя, поэтому это заметный вес.
 *
 * ВАЖНО: тренды считаем ТОЛЬКО по якорным запросам (позиции), а НЕ по
 * агрегатам Яндекса — у них плавает состав окна (см. бриф).
 */

export interface ScoreInput {
  /** Текущие позиции якорей (по всем движкам), null = вне выдачи. */
  anchorPositions: (number | null)[];
  /** Позиции якорей N дней назад (сопоставимы по индексам). */
  anchorPositionsPast: (number | null)[];
  /** Живых источников из отслеживаемых (Я, Google, Bing). */
  sourcesAlive: number;
  sourcesTotal: number;
}

export const SCORE_WEIGHTS = { top10: 0.5, trend: 0.2, sources: 0.3 } as const;

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function computeScore(input: ScoreInput): Score {
  const { anchorPositions, anchorPositionsPast, sourcesAlive, sourcesTotal } = input;

  // 1) Доля якорей в топ-10.
  const tracked = anchorPositions.length || 1;
  const inTop10 = anchorPositions.filter((p) => p != null && p <= 10).length;
  const inTop3 = anchorPositions.filter((p) => p != null && p <= 3).length;
  // топ-3 весит чуть больше: 100% за топ-10 + бонус за топ-3.
  const top10Sub = clamp((inTop10 / tracked) * 85 + (inTop3 / tracked) * 15);

  // 2) Тренд позиций якорей (позиция меньше = лучше).
  let improved = 0;
  let worsened = 0;
  for (let i = 0; i < anchorPositions.length; i++) {
    const now = anchorPositions[i];
    const past = anchorPositionsPast[i];
    if (now == null || past == null) continue;
    const d = past - now; // >0 => позиция улучшилась
    if (d > 0.3) improved++;
    else if (d < -0.3) worsened++;
  }
  const comparable = improved + worsened;
  // 50 = нейтрально; сдвигаем в стороны по перевесу.
  const trendSub = comparable === 0 ? 55 : clamp(50 + ((improved - worsened) / comparable) * 45);

  // 3) Живость источников.
  const sourcesSub = clamp((sourcesAlive / Math.max(1, sourcesTotal)) * 100);

  const value = Math.round(
    top10Sub * SCORE_WEIGHTS.top10 +
      trendSub * SCORE_WEIGHTS.trend +
      sourcesSub * SCORE_WEIGHTS.sources
  );

  let tone: Tone;
  let verdict: string;
  const growing = improved > worsened;
  if (value >= 68) {
    tone = "good";
    verdict = growing ? "Растём" : "Стабильно";
  } else if (value >= 45) {
    tone = "ok";
    verdict = growing ? "Набираем ход" : "Стабильно";
  } else {
    tone = "warn";
    verdict = "Требует внимания";
  }

  return {
    value,
    verdict,
    tone,
    breakdown: [
      {
        label: "Якоря в топ-10",
        value: Math.round(top10Sub),
        weight: SCORE_WEIGHTS.top10,
        hint: `${inTop10} из ${tracked} целевых запросов на первой странице`,
      },
      {
        label: "Тренд позиций",
        value: Math.round(trendSub),
        weight: SCORE_WEIGHTS.trend,
        hint:
          comparable === 0
            ? "недостаточно данных для сравнения"
            : `${improved} растут · ${worsened} проседают`,
      },
      {
        label: "Живость сканера",
        value: Math.round(sourcesSub),
        weight: SCORE_WEIGHTS.sources,
        hint: `${sourcesAlive} из ${sourcesTotal} источников отвечают`,
      },
    ],
  };
}
