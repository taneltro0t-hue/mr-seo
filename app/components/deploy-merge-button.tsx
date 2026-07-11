"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Rocket, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import type { DeployMergeResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type Phase = "idle" | "confirm" | "busy" | "done" | "err";

/**
 * Двухшаговая боевая кнопка «Слить и задеплоить».
 *  idle → confirm (честное предупреждение о живом сайте) → busy (POST, disabled)
 *       → done | err. Переиспользуется в «Деплоях» и на карточке «Сегодня».
 *  onMerged срабатывает при успехе — вызывающий может переместить карточку.
 */
export function MergeDeployButton({
  site,
  branch,
  onMerged,
  className,
}: {
  site: string;
  branch: string;
  onMerged?: (note: string) => void;
  className?: string;
}) {
  const { t } = useT();
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");

  const fire = async () => {
    if (phase === "busy" || phase === "done") return;
    setPhase("busy");
    setErr("");
    try {
      const r = await fetch("/api/deploys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site, branch }),
      });
      const d = (await r.json()) as DeployMergeResult;
      if (d.ok) {
        setPhase("done");
        onMerged?.(d.note ?? "");
      } else {
        setPhase("err");
        setErr(d.error ?? "HTTP " + r.status);
      }
    } catch (e) {
      setPhase("err");
      setErr(String(e).slice(0, 140));
    }
  };

  const busy = phase === "busy";

  return (
    <div className={cn("min-w-0", className)}>
      <AnimatePresence mode="wait" initial={false}>
        {/* idle — приглашение */}
        {phase === "idle" && (
          <motion.button
            key="idle"
            type="button"
            onClick={() => setPhase("confirm")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-iris px-4 py-2.5 text-[12.5px] font-600 text-base-2 transition-opacity hover:opacity-90"
          >
            <Rocket size={14} strokeWidth={2.4} />
            {t("deploys.merge_cta")}
          </motion.button>
        )}

        {/* confirm — честное предупреждение о живом сайте */}
        {phase === "confirm" && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-warn/30 bg-warn/[0.05] p-3.5"
          >
            <div className="flex items-start gap-2.5">
              <TriangleAlert size={15} className="mt-0.5 flex-none text-warn" />
              <p className="text-[13px] leading-snug text-ink">
                {t("deploys.merge_confirm_q", { branch })}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={fire}
                className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-warn px-3.5 py-2 text-[12px] font-700 text-base-2 transition-opacity hover:opacity-90"
              >
                <Rocket size={13} strokeWidth={2.6} />
                {t("deploys.merge_go")}
              </button>
              <button
                type="button"
                onClick={() => setPhase("idle")}
                className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-[12px] font-600 text-muted transition-colors hover:bg-white/[0.05] hover:text-ink"
              >
                <X size={13} />
                {t("common.cancel")}
              </button>
            </div>
          </motion.div>
        )}

        {/* busy — POST идёт, кнопка заблокирована */}
        {busy && (
          <motion.div
            key="busy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              disabled
              aria-busy="true"
              className="inline-flex cursor-wait items-center gap-2 rounded-lg bg-iris/70 px-4 py-2.5 text-[12.5px] font-600 text-base-2 opacity-80"
            >
              <Loader2 size={14} className="animate-spin" />
              {t("deploys.merge_busy")}
            </button>
          </motion.div>
        )}

        {/* done — успех */}
        {phase === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 rounded-lg bg-good/15 px-4 py-2.5 text-[12.5px] font-600 text-good"
          >
            <Check size={14} strokeWidth={3} />
            {t("deploys.merge_done")}
          </motion.div>
        )}

        {/* err — честная красная строка + повтор */}
        {phase === "err" && (
          <motion.div
            key="err"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap items-center gap-x-3 gap-y-2"
          >
            <button
              type="button"
              onClick={() => setPhase("confirm")}
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-warn/40 bg-warn/[0.06] px-3.5 py-2 text-[12px] font-600 text-warn transition-colors hover:bg-warn/[0.12]"
            >
              <Rocket size={13} />
              {t("common.retry")}
            </button>
            <span className="min-w-0 text-[11.5px] leading-snug text-warn">
              {t("deploys.merge_err_prefix")}
              {err}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
