import "server-only";
import type { Hypothesis, HypothesesResponse, HypoStatus, Lesson } from "./types";
import { readGraveyardRaw, readHypothesesRaw } from "./fs-data";

const COLUMN_ORDER: { status: HypoStatus; label: string }[] = [
  { status: "proposed", label: "Предложены" },
  { status: "pending", label: "В работе" },
  { status: "observe", label: "Наблюдаем" },
  { status: "confirmed", label: "Подтверждены" },
  { status: "partial", label: "Частично" },
  { status: "falsified", label: "Опровергнуты" },
];

const MOCK_HYPOS: Hypothesis[] = [
  {
    id: "h-epos-author-moscow",
    commit_date: "2026-06-29",
    site: "mysite",
    urls: ["/moscow"],
    change:
      "Добавить на /moscow секцию «Команда» с реальным звукорежиссёром + Person JSON-LD. Ответ на кто/что/цена/адрес в первых 1000 символов.",
    expected: "ЭПОС-сигнал Яндекс: страница становится «экспертной». Подъём в Нейро-выдаче за 1-2 мес.",
    status: "proposed",
    verify_due: "2026-07-13",
    executor: "Антон",
    graveyard_check: "Реальный эксперт, не выдуманный.",
  },
  {
    id: "h-geo-optimizer-audit",
    commit_date: "2026-06-29",
    site: "mysite+demo2",
    urls: ["https://example.com"],
    change: "geo audit + geo schema для двух сайтов, подключить MCP geo-optimizer.",
    expected: "8-категорийный score, schema-гэпы, LLM-extraction 16%→54%.",
    status: "proposed",
    verify_due: "2026-07-13",
    executor: "Бот",
    graveyard_check: "Только audit + schema gen.",
  },
];

function normalize(raw: unknown): Hypothesis[] | null {
  if (!raw) return null;
  const arr = Array.isArray(raw)
    ? raw
    : (raw as { hypotheses?: unknown }).hypotheses;
  if (!Array.isArray(arr)) return null;
  return arr
    .filter((h): h is Hypothesis => !!h && typeof h === "object" && "id" in h)
    .map((h) => ({ ...h, status: (h.status as HypoStatus) || "proposed" }));
}

/** Парсит graveyard.md в карточки уроков L-00x / C-00x. */
function parseLessons(md: string | null): Lesson[] {
  if (!md) return [];
  const lines = md.split("\n");
  const heads: { idx: number; id: string; title: string }[] = [];
  const re = /^#{2,4}\s+((?:L|C)-\d{3})\s*[·—-]\s*(.+?)\s*$/;
  lines.forEach((line, idx) => {
    const m = line.match(re);
    if (m) heads.push({ idx, id: m[1], title: m[2].replace(/\*\*/g, "").trim() });
  });
  const lessons: Lesson[] = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].idx + 1;
    const end = i + 1 < heads.length ? heads[i + 1].idx : lines.length;
    const body = lines
      .slice(start, end)
      .join("\n")
      .replace(/\*\*/g, "")
      .trim()
      .slice(0, 900);
    lessons.push({
      id: heads[i].id,
      kind: heads[i].id.startsWith("C") ? "confirmed" : "falsified",
      title: heads[i].title,
      body,
    });
  }
  return lessons;
}

export function buildHypotheses(): HypothesesResponse {
  const parsed = normalize(readHypothesesRaw());
  const mock = parsed == null;
  const hypos = parsed ?? MOCK_HYPOS;

  const columns = COLUMN_ORDER.map(({ status, label }) => ({
    status,
    label,
    items: hypos.filter((h) => h.status === status),
  }));

  const lessons = parseLessons(readGraveyardRaw());

  return {
    mock,
    columns,
    lessons,
    stats: {
      total: hypos.length,
      confirmed: hypos.filter((h) => h.status === "confirmed").length,
      falsified: hypos.filter((h) => h.status === "falsified").length,
      active: hypos.filter((h) => ["proposed", "pending", "observe"].includes(h.status)).length,
    },
  };
}
