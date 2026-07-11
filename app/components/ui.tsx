"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Check, Copy, Minus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Tone, Trend } from "@/lib/types";

export function Panel({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass", className)} {...rest}>
      {children}
    </div>
  );
}

/** Контейнер со staggered-входом детей. */
export function Stagger({
  children,
  className,
  delay = 0,
  step = 0.07,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  step?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: step, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}

export const staggerItem = {
  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("cap", className)}>{children}</div>;
}

/** Mono index tag: [ 01 ]. Editorial numbering, JetBrains Mono. */
export function IndexTag({ n, className }: { n: number | string; className?: string }) {
  const s = typeof n === "number" ? String(n).padStart(2, "0") : n;
  return (
    <span className={cn("mono text-[10.5px] tracking-[0.1em] text-ghost", className)}>
      [ {s} ]
    </span>
  );
}

/**
 * Editorial section header — mono eyebrow with running index, giant Unbounded
 * title, optional right-aligned note. The typographic drama that replaces
 * uniform panel headers.
 */
export function SectionIntro({
  index,
  eyebrow,
  title,
  note,
  className,
}: {
  index?: number | string;
  eyebrow: string;
  title: React.ReactNode;
  note?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-8 gap-y-3", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          {index != null && <IndexTag n={index} />}
          <span className="cap">{eyebrow}</span>
        </div>
        <h2 className="mt-3 font-display text-[clamp(1.9rem,3.4vw,3rem)] font-500 leading-[0.98] tracking-[-0.035em] text-ink">
          {title}
        </h2>
      </div>
      {note && (
        <p className="max-w-[340px] text-right text-[12.5px] leading-relaxed text-faint">{note}</p>
      )}
    </div>
  );
}

/**
 * Page header — the editorial voice shared by every sub-view: mono eyebrow,
 * giant Unbounded title, lede, optional right slot (badge / actions).
 */
export function PageHead({
  eyebrow,
  title,
  lede,
  right,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex flex-wrap items-end justify-between gap-x-8 gap-y-5", className)}
    >
      <div className="min-w-0">
        <span className="cap">{eyebrow}</span>
        <h1 className="mt-3 font-display text-[clamp(2.1rem,4.6vw,3.6rem)] font-500 leading-[0.95] tracking-[-0.04em] text-ink">
          {title}
        </h1>
        {lede && <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-muted">{lede}</p>}
      </div>
      {right && <div className="flex flex-none items-center gap-2">{right}</div>}
    </motion.div>
  );
}

/**
 * HUD readout cell — cockpit-style metric on black: mono caption, big tabular
 * value, thin under-rail. No card. Separated by vertical rules in a strip.
 */
export function HudReadout({
  label,
  value,
  sub,
  accent = "var(--color-ink)",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 px-5 py-1", className)}>
      <div className="cap truncate">{label}</div>
      <div
        className="mono tabular mt-2 text-[26px] font-600 leading-none"
        style={{ color: accent }}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 truncate text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

const TONE_STYLE: Record<Tone, string> = {
  good: "text-good bg-good/10 border-good/25",
  ok: "text-ok bg-ok/10 border-ok/25",
  warn: "text-warn bg-warn/10 border-warn/25",
};

export function ToneDot({ tone, className }: { tone: Tone; className?: string }) {
  const c = tone === "good" ? "#4bd39a" : tone === "ok" ? "#f4c25a" : "#ff6b6b";
  return (
    <span className={cn("relative inline-flex h-2 w-2", className)}>
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
        style={{ background: c }}
      />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: c }} />
    </span>
  );
}

export function Badge({
  tone = "good",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-600",
        TONE_STYLE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Тренд позиций: improving=up(зелёный), worsening=down(красный). */
export function TrendPill({
  trend,
  delta,
  unit = "",
  className,
}: {
  trend: Trend;
  delta: number | null;
  unit?: string;
  className?: string;
}) {
  const cfg =
    trend === "up"
      ? { c: "text-good", Icon: ArrowUpRight }
      : trend === "down"
        ? { c: "text-warn", Icon: ArrowDownRight }
        : { c: "text-faint", Icon: Minus };
  const { Icon } = cfg;
  const val = delta == null ? "—" : Math.abs(delta).toFixed(1).replace(/\.0$/, "");
  return (
    <span className={cn("mono inline-flex items-center gap-0.5 text-xs font-600", cfg.c, className)}>
      <Icon size={13} strokeWidth={2.5} />
      {val}
      {unit}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

/** Кнопка «скопировать» с состоянием подтверждения. */
export function CopyButton({
  value,
  label = "Скопировать",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard недоступен */
        }
      }}
      className={cn(
        "focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5 text-xs font-500 text-muted transition-colors hover:bg-white/[0.07] hover:text-ink",
        done && "border-good/30 text-good",
        className
      )}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
      {done ? "Скопировано" : label}
    </button>
  );
}

/** Центрированная модалка со стеклом и затемнением. */
export function Modal({
  open,
  onClose,
  children,
  labelledBy,
  maxWidth = 560,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
  maxWidth?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            className="glass relative my-auto w-full p-7"
            style={{ maxWidth }}
            initial={{ opacity: 0, y: 26, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="focus-ring absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-line text-faint transition-colors hover:bg-white/[0.06] hover:text-ink"
            >
              <X size={15} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function FadeIn({
  children,
  delay = 0,
  y = 14,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
