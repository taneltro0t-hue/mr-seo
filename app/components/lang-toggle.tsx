"use client";

import { useT, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LANGS: Lang[] = ["ru", "en"];

/**
 * Компактный переключатель RU/EN в стиле mono .cap. Активный — ярче.
 * Используется внизу рэйла (vertical) и в мобильной шапке (inline).
 */
export function LangToggle({
  className,
  orientation = "horizontal",
}: {
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  const { lang, setLang, t } = useT();
  return (
    <div
      className={cn(
        "flex items-center gap-0.5",
        orientation === "vertical" && "flex-col",
        className
      )}
      role="group"
      aria-label={t("nav.lang")}
    >
      {LANGS.map((l) => {
        const on = l === lang;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={on}
            className={cn(
              "cap focus-ring rounded-md px-1.5 py-0.5 text-[9.5px] tracking-[0.16em] transition-colors",
              on ? "bg-white/[0.06] text-ink" : "text-ghost hover:text-faint"
            )}
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
