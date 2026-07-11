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
