import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Разбирает имя запроса вида «студия звукозаписи [Y]» → { query, engine }. */
export function splitQueryTag(raw: string): { query: string; engine: "yandex" | "google" | null } {
  const m = raw.match(/^(.*?)\s*\[([YG])\]\s*$/);
  if (!m) return { query: raw.trim(), engine: null };
  return { query: m[1].trim(), engine: m[2] === "Y" ? "yandex" : "google" };
}

/** Стабильное ядро задачи: тег [..] + суть без летучих цифр (поз/спрос меняются ежедневно). */
export function taskCore(text: string): string {
  let s = text.toLowerCase().replace(/ё/g, "е");
  const tag = s.match(/^\s*(\[[^\]]+\])/)?.[1] ?? "";
  const quoted = s.match(/[«"]([^»"]{3,80})[»"]/)?.[1] ?? "";
  s = s
    .replace(/\(поз[^)]*\)/g, "")
    .replace(/\(спрос[^)]*\)/g, "")
    .replace(/\d+[.,]?\d*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (tag + "|" + (quoted || s)).slice(0, 140);
}
