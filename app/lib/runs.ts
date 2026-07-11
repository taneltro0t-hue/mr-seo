import "server-only";
import type { RunSummary, RunsResponse, Tone } from "./types";
import { readRunsRaw } from "./fs-data";

const MOCK_MD = `# Аналитик 2026-07-05

## Сводка

⚠️ Алертов Сторожа нет.

🟡 low-light: Я-клики 12→7 (в пределах шума окна), Google второй день подряд 0 клк. Якорь «заказать съемку клипа в москве» непрерывно ползёт вниз 5 дней подряд (10.37→11.32) — реальный тренд по Москве. Делать: публикация DTF-статьи — единственный рычаг сдвинуть Москву.

🟢 demo2: рост продолжается — Я 34→35клк, Google 74→82зпр, +2 отзыва (53→55). Не трогать — растёт сам.

🟢 demo326: Я-клики выросли 2→5, держится второй день.`;

/** Извлекает строки-сигналы (🟢/🟡/🔴/⚠️) из markdown-сводки. */
function extractSignals(md: string): RunSummary["signals"] {
  const signals: RunSummary["signals"] = [];
  const lines = md.split("\n");
  for (const line of lines) {
    const t = line.trim();
    let tone: Tone | null = null;
    if (t.startsWith("🟢")) tone = "good";
    else if (t.startsWith("🟡") || t.startsWith("⚠️")) tone = "ok";
    else if (t.startsWith("🔴")) tone = "warn";
    if (!tone) continue;
    const clean = t.replace(/^[🟢🟡🔴⚠️]+\s*/u, "").trim();
    if (!clean) continue;
    const siteMatch = clean.match(/^([a-zA-Zа-яё0-9_.-]+):/u);
    signals.push({
      site: siteMatch ? siteMatch[1] : "сводка",
      tone,
      text: siteMatch ? clean.slice(siteMatch[0].length).trim() : clean,
    });
  }
  return signals;
}

function titleFrom(md: string, slug: string): string {
  const h1 = md.match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : slug;
}
function dateFrom(slug: string): string {
  const m = slug.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : slug;
}

export function buildRuns(): RunsResponse {
  const raw = readRunsRaw(40);
  if (raw.length === 0) {
    return {
      mock: true,
      runs: [
        {
          slug: "2026-07-05-analyst",
          date: "2026-07-05",
          title: "Аналитик 2026-07-05",
          markdown: MOCK_MD,
          signals: extractSignals(MOCK_MD),
        },
      ],
    };
  }
  const runs: RunSummary[] = raw.map((r) => ({
    slug: r.slug,
    date: dateFrom(r.slug),
    title: titleFrom(r.markdown, r.slug),
    markdown: r.markdown,
    signals: extractSignals(r.markdown),
  }));
  return { mock: false, runs };
}
