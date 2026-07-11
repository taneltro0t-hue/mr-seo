"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const LAST_KEY = "mrseo:notify:last";
const THROTTLE_MS = 4 * 60 * 60 * 1000; // не чаще раза в 4 часа

function supported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Web-уведомление о делах дня — с троттлом (не чаще раза в 4 ч). Вызывается на
 * загрузке /today, если разрешение выдано и есть дела, ждущие клика.
 */
export function notifyTodayActions(count: number) {
  if (!supported() || count <= 0) return;
  if (Notification.permission !== "granted") return;
  try {
    const last = Number(localStorage.getItem(LAST_KEY) || 0);
    if (Date.now() - last < THROTTLE_MS) return;
    localStorage.setItem(LAST_KEY, String(Date.now()));
    const word = count === 1 ? "дело ждёт" : count >= 2 && count <= 4 ? "дела ждут" : "дел ждут";
    new Notification("Mr.Seo", {
      body: `${count} ${word} клика`,
      tag: "mrseo-today",
      icon: "/icon.png",
    });
  } catch {
    /* уведомления недоступны */
  }
}

/** Колокольчик в рэйле: запрашивает разрешение на web-уведомления. */
export function NotificationBell() {
  const [perm, setPerm] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (supported()) setPerm(Notification.permission);
  }, []);

  if (perm === null) return null; // не поддерживается / до маунта

  const request = async () => {
    if (!supported() || perm === "denied") return;
    try {
      const res = await Notification.requestPermission();
      setPerm(res);
      if (res === "granted") {
        new Notification("Mr.Seo", { body: "Уведомления включены — сообщу, когда появятся дела." });
      }
    } catch {
      /* ignore */
    }
  };

  const granted = perm === "granted";
  const denied = perm === "denied";
  const Icon = granted ? BellRing : denied ? BellOff : Bell;
  const tip = granted
    ? "Уведомления включены"
    : denied
      ? "Уведомления заблокированы в браузере"
      : "Включить уведомления о делах";

  return (
    <div className="group relative flex items-center justify-center">
      <button
        type="button"
        onClick={request}
        aria-label={tip}
        disabled={denied}
        className={cn(
          "focus-ring flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
          granted
            ? "text-good hover:bg-white/[0.04]"
            : denied
              ? "cursor-not-allowed text-ghost"
              : "text-faint hover:bg-white/[0.04] hover:text-ink"
        )}
      >
        <Icon size={16} strokeWidth={2} />
      </button>
      <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg border border-line bg-base-2/95 px-2.5 py-1.5 text-[12px] font-500 text-ink opacity-0 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100">
        {tip}
      </span>
    </div>
  );
}
