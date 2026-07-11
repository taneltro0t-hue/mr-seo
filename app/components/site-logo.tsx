"use client";

import { useState } from "react";
import type { SiteKey } from "@/lib/types";
import { SITES } from "@/lib/sites";
import { cn } from "@/lib/utils";

/**
 * OG-логотип сайта в кольце его акцентного цвета. Логотип тянется из
 * /api/logo?site= (favicon/og-картинка). При сбое — фолбэк на цветной кружок
 * (прежняя идентичность канала). Цвет канала сохраняется в обоих случаях.
 */
export function SiteLogo({
  site,
  size = 32,
  active = true,
  glow = false,
  className,
  rounded = "rounded-xl",
}: {
  site: SiteKey;
  size?: number;
  active?: boolean;
  glow?: boolean;
  className?: string;
  rounded?: string;
}) {
  const meta = SITES[site];
  const accent = meta.accent;
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={cn("relative inline-flex flex-none items-center justify-center", rounded, className)}
      style={{
        width: size,
        height: size,
        border: `1px solid ${accent}${active ? "66" : "33"}`,
        background: `radial-gradient(120% 120% at 30% 22%, ${accent}22, ${accent}0a 60%, transparent)`,
        boxShadow: glow && active ? `0 0 14px ${accent}99` : undefined,
        opacity: active ? 1 : 0.5,
      }}
      aria-hidden
    >
      {failed ? (
        <span
          className={cn(rounded)}
          style={{
            width: size * 0.42,
            height: size * 0.42,
            background: `radial-gradient(120% 120% at 30% 25%, ${accent}, ${accent}55 70%, transparent)`,
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/logo?site=${site}`}
          alt=""
          width={Math.round(size * 0.64)}
          height={Math.round(size * 0.64)}
          onError={() => setFailed(true)}
          className={cn("object-contain", rounded)}
          style={{ width: size * 0.64, height: size * 0.64 }}
        />
      )}
    </span>
  );
}
