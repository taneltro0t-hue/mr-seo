"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useChat, useSite } from "@/components/providers";
import { DispatchButton } from "@/components/views/dashboard-insights";
import { SeoOrb } from "@/components/seo-orb";
import { useT } from "@/lib/i18n";
import type { OrbState } from "@/components/providers";
import { cn } from "@/lib/utils";

/**
 * Стрим мозга может заканчиваться служебной строкой
 *   ACTION: [chat mysite] <что поручить рою>
 * Её нельзя показывать как текст — вырезаем и отдаём отдельно, чтобы под
 * сообщением нарисовать кнопку «Поручить рою».
 */
function splitAction(raw: string): { body: string; action: string | null } {
  const m = raw.match(/\n?\s*ACTION:\s*([\s\S]*)$/i);
  if (m && m.index != null) {
    const action = m[1].trim();
    return { body: raw.slice(0, m.index).trimEnd(), action: action || null };
  }
  return { body: raw, action: null };
}

/** Убирает служебный префикс [chat site] из текста действия для показа. */
function actionLabel(action: string): string {
  return action.replace(/^\s*\[[^\]]*\]\s*/, "").trim() || action;
}

const SUGGESTION_KEYS = ["chat.sugg_1", "chat.sugg_2", "chat.sugg_3"] as const;

const STATUS_KEY: Record<OrbState, string> = {
  idle: "chat.status_idle",
  thinking: "chat.status_thinking",
  speaking: "chat.status_speaking",
};

/**
 * Плавающий компаньон — орб у правого края, вертикально по центру. Едет со
 * скроллом (fixed), тихо дышит и дрейфует (параллакс-живость), цветом реагирует
 * на статус канала (tint) и на диалог (orbState). Клик — правый drawer чата.
 */
export function ChatLauncher() {
  const { open, setOpen, orbState } = useChat();
  const { tint } = useSite();
  const { t } = useT();
  return (
    <AnimatePresence>
      {!open && (
        <motion.button
          initial={{ scale: 0, opacity: 0, x: 48 }}
          animate={{ scale: 1, opacity: 1, x: 0 }}
          exit={{ scale: 0, opacity: 0, x: 48 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          onClick={() => setOpen(true)}
          aria-label={t("chat.ask")}
          className="focus-ring group fixed bottom-16 right-4 z-40 rounded-full sm:bottom-14 sm:right-6"
        >
          {/* мягкий дрейф вверх-вниз — «дыхание» компаньона */}
          <motion.span
            animate={{ y: [0, -9, 0] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
            className="relative flex items-center"
          >
            {/* всплывающая подпись слева при наведении */}
            <span className="glass pointer-events-none invisible absolute right-full mr-3 hidden translate-x-1 whitespace-nowrap rounded-full px-4 py-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-x-0 group-hover:opacity-100 sm:block">
              <span className="block text-[13px] font-600 leading-tight text-ink">{t("chat.ask")}</span>
              <span className="block text-[10.5px] text-faint">{t(STATUS_KEY[orbState])}</span>
            </span>
            <SeoOrb size={62} state={orbState} tint={tint} hero interactive />
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export function ChatPanel() {
  const { open, setOpen, messages, send, orbState, streaming } = useChat();
  const { tint } = useSite();
  const { t } = useT();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = () => {
    if (!input.trim() || streaming) return;
    send(input);
    setInput("");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:bg-black/30"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-line bg-base-2/95 backdrop-blur-2xl"
          >
            {/* header */}
            <div className="flex items-center gap-3 border-b border-line px-5 py-4">
              <SeoOrb size={52} state={orbState} tint={tint} />
              <div className="min-w-0 flex-1">
                <div className="font-display text-base font-600">Mr.Seo</div>
                <div className="flex items-center gap-1.5 text-[11px] text-faint">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      orbState === "idle" ? "bg-good" : "bg-iris"
                    )}
                  />
                  {t(STATUS_KEY[orbState])}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="focus-ring rounded-lg p-2 text-faint hover:bg-white/5 hover:text-ink"
                aria-label={t("chat.close_chat")}
              >
                <X size={18} />
              </button>
            </div>

            {/* messages */}
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {messages.length === 0 && (
                <div className="flex flex-col items-center gap-5 pt-8 text-center">
                  <SeoOrb size={112} state="idle" tint={tint} interactive />
                  <div>
                    <div className="font-display text-lg font-600">{t("chat.greet_title")}</div>
                    <p className="mx-auto mt-2 max-w-[280px] text-sm text-muted">
                      {t("chat.greet_body")}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTION_KEYS.map((k) => {
                      const s = t(k);
                      return (
                        <button
                          key={k}
                          onClick={() => send(s)}
                          className="focus-ring rounded-full border border-line bg-white/[0.02] px-3 py-1.5 text-xs text-muted transition-colors hover:border-iris/40 hover:text-ink"
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {messages.map((m) => {
                const isAssistant = m.role === "assistant";
                const { body, action } = isAssistant
                  ? splitAction(m.content)
                  : { body: m.content, action: null };
                return (
                  <div key={m.id} className={cn("flex gap-2.5", isAssistant ? "justify-start" : "justify-end")}>
                    {isAssistant && <SeoOrb size={26} state="idle" className="mt-1" />}
                    <div className={cn("flex max-w-[80%] flex-col gap-2", isAssistant ? "items-start" : "items-end")}>
                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                          isAssistant
                            ? "rounded-bl-sm border border-line bg-panel text-ink/90"
                            : "rounded-br-sm bg-iris/15 text-ink"
                        )}
                      >
                        {body || (streaming ? <TypingDots /> : null)}
                      </div>
                      {action && <ChatAction action={action} />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* input */}
            <div className="border-t border-line p-4">
              <div className="flex items-end gap-2 rounded-2xl border border-line bg-panel px-3 py-2 focus-within:border-iris/40">
                <textarea
                  name="mrseo-chat"
                  autoComplete="off"
                  aria-label={t("chat.input_aria")}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  rows={1}
                  placeholder={t("chat.placeholder")}
                  className="max-h-32 flex-1 resize-none bg-transparent py-1 text-sm text-ink placeholder:text-faint focus:outline-none"
                />
                <button
                  onClick={submit}
                  disabled={!input.trim() || streaming}
                  className="focus-ring flex h-8 w-8 flex-none items-center justify-center rounded-full bg-iris text-base-2 transition-opacity disabled:opacity-30"
                  aria-label={t("common.send")}
                >
                  <ArrowUp size={17} strokeWidth={2.5} />
                </button>
              </div>
              <p className="mt-2 px-1 text-[10px] text-faint">
                {t("chat.disclaimer")}
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/** Предложенное мозгом действие под ответом — вырезано из строки ACTION. */
function ChatAction({ action }: { action: string }) {
  const { t } = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-[300px] rounded-2xl border border-iris/25 bg-iris/[0.06] p-3"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles size={13} className="text-iris" />
        <span className="cap text-iris/80">{t("chat.suggests")}</span>
      </div>
      <p className="mb-3 text-[13px] leading-snug text-ink/90">{actionLabel(action)}</p>
      <DispatchButton text={action} />
    </motion.div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}
