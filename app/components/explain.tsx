"use client";

import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SiteKey } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Status = "idle" | "thinking" | "streaming" | "done" | "error";

interface Coords {
  left: number;
  width: number;
  placement: "top" | "bottom";
  top?: number; // якорим сверху (placement=bottom)
  bottom?: number; // якорим снизу (placement=top) — без CSS-transform, чтобы не конфликтовать с Framer
}

const POP_W = 320;

/** Мозг (orchestrator chat) иногда дописывает служебную строку «ACTION: …» —
 *  для объяснения цифры она лишняя, показываем только человеческий текст. */
function stripAction(raw: string): string {
  return raw.replace(/\n?\s*ACTION:\s*[\s\S]*$/i, "").trimEnd();
}

/**
 * <Explain> — оборачивает любую метрику. Клик по цифре (курсор help,
 * пунктир-подчёркивание при hover) открывает компактный glass-поповер, куда
 * стримится объяснение мозга (/api/explain). Portal + fixed-позиция, чтобы не
 * обрезаться в overflow-hidden контейнерах (hero). Ответ кэшируется на маунт —
 * повторное открытие не дёргает мозг заново.
 */
export function Explain({
  site,
  metric,
  value,
  context,
  children,
  className,
}: {
  site: SiteKey;
  metric: string;
  value: string | number;
  context?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(POP_W, vw - 32);
    const left = Math.max(16, Math.min(r.left, vw - width - 16));
    if (r.bottom > vh * 0.62) {
      setCoords({ placement: "top", left, width, bottom: vh - r.top + 8 });
    } else {
      setCoords({ placement: "bottom", left, width, top: r.bottom + 8 });
    }
  }, []);

  const runExplain = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("thinking");
    setText("");
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site, metric, value: String(value), context: context ?? "", lang }),
        signal: ctrl.signal,
      });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let first = true;
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        if (first) {
          setStatus("streaming");
          first = false;
        }
        setText((t) => t + dec.decode(chunk, { stream: true }));
      }
      setStatus("done");
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      fetchedRef.current = false; // разрешить повтор после сбоя
      setStatus("error");
    }
  }, [site, metric, value, context, lang]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    place();
    setOpen(true);
    void runExplain();
  };

  // позиционируем до первой отрисовки, закрываем при скролле/ресайзе
  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => setOpen(false);
    const onResize = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, place]);

  // Escape + клик мимо
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={t("explain.explain_metric", { metric })}
        className={cn(
          "group/ex inline cursor-help appearance-none border-b border-dotted border-transparent bg-transparent p-0 font-[inherit] text-[inherit] leading-[inherit] transition-colors hover:border-white/40",
          open && "border-white/50",
          className
        )}
      >
        {children}
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                ref={popRef}
                initial={{ opacity: 0, y: coords.placement === "bottom" ? -6 : 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: coords.placement === "bottom" ? -6 : 6, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                role="dialog"
                aria-label={t("explain.explanation_of", { metric })}
                className="glass z-[90] p-4"
                style={{
                  position: "fixed",
                  left: coords.left,
                  width: coords.width,
                  ...(coords.top != null ? { top: coords.top } : {}),
                  ...(coords.bottom != null ? { bottom: coords.bottom } : {}),
                }}
              >
                <div className="mb-2.5 flex items-center gap-2">
                  <Sparkles size={13} className="text-iris" />
                  <span className="cap text-iris/80">{t("explain.title")}</span>
                  <span className="mono ml-auto truncate max-w-[120px] text-[10px] text-ghost" title={metric}>
                    {metric}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={t("common.close")}
                    className="focus-ring -mr-1 rounded-md p-1 text-faint transition-colors hover:text-ink"
                  >
                    <X size={13} />
                  </button>
                </div>

                {status === "thinking" && <ThinkingPulse label={t("explain.thinking")} />}
                {(status === "streaming" || status === "done") && (
                  <p className="text-[13px] leading-relaxed text-ink/90">
                    {stripAction(text)}
                    {status === "streaming" && (
                      <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-iris/70" />
                    )}
                  </p>
                )}
                {status === "error" && (
                  <div className="flex items-start gap-2 text-[12.5px] leading-relaxed text-faint">
                    <HelpCircle size={14} className="mt-0.5 flex-none text-warn" />
                    {t("explain.error")}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

function ThinkingPulse({ label }: { label: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <motion.span
          className="h-2 w-2 flex-none rounded-full bg-iris"
          animate={{ opacity: [1, 0.3, 1], scale: [1, 0.7, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ boxShadow: "0 0 10px rgba(139,147,255,0.7)" }}
        />
        <span className="mono text-[11px] text-faint">{label}</span>
      </div>
      <div className="skeleton h-3 w-full rounded" />
      <div className="skeleton h-3 w-4/5 rounded" />
      <div className="skeleton h-3 w-2/3 rounded" />
    </div>
  );
}
