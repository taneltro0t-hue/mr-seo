"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { SiteKey } from "@/lib/types";
import { AppShell } from "@/components/app-shell";

/* ----------------------------- Site context ----------------------------- */

export type SiteTint = "neutral" | "good" | "ok" | "warn";

interface SiteCtx {
  site: SiteKey;
  setSite: (s: SiteKey) => void;
  tint: SiteTint;
  setTint: (t: SiteTint) => void;
}
const SiteContext = createContext<SiteCtx | null>(null);
export function useSite() {
  const c = useContext(SiteContext);
  if (!c) throw new Error("useSite must be used within Providers");
  return c;
}

/* ----------------------------- Chat context ----------------------------- */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}
export type OrbState = "idle" | "thinking" | "speaking";

interface ChatCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  messages: ChatMessage[];
  send: (text: string) => void;
  orbState: OrbState;
  streaming: boolean;
}
const ChatContext = createContext<ChatCtx | null>(null);
export function useChat() {
  const c = useContext(ChatContext);
  if (!c) throw new Error("useChat must be used within Providers");
  return c;
}

/* ------------------------------- Provider ------------------------------- */

const uid = () => Math.random().toString(36).slice(2, 10);

export function Providers({ children }: { children: React.ReactNode }) {
  const [site, setSiteState] = useState<SiteKey>("mysite");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [streaming, setStreaming] = useState(false);
  const [tint, setTint] = useState<SiteTint>("neutral");
  const siteRef = useRef(site);
  siteRef.current = site;

  // restore site
  useEffect(() => {
    const saved = localStorage.getItem("mrseo:site") as SiteKey | null;
    if (saved === "mysite" || saved === "demo2" || saved === "demo3") setSiteState(saved);
  }, []);
  const setSite = useCallback((s: SiteKey) => {
    setSiteState(s);
    localStorage.setItem("mrseo:site", s);
  }, []);

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", content: trimmed };
    const botMsg: ChatMessage = { id: uid(), role: "assistant", content: "" };
    setMessages((m) => [...m, userMsg, botMsg]);
    setStreaming(true);
    setOrbState("thinking");

    (async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, site: siteRef.current }),
        });
        if (!res.body) throw new Error("no body");
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let first = true;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (first) {
            setOrbState("speaking");
            first = false;
          }
          const chunk = dec.decode(value, { stream: true });
          setMessages((m) =>
            m.map((msg) => (msg.id === botMsg.id ? { ...msg, content: msg.content + chunk } : msg))
          );
        }
      } catch {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === botMsg.id
              ? { ...msg, content: "Не удалось получить ответ. Мозг Mr.Seo ещё подключается." }
              : msg
          )
        );
      } finally {
        setStreaming(false);
        setOrbState("idle");
      }
    })();
  }, [streaming]);

  const siteValue = useMemo(() => ({ site, setSite, tint, setTint }), [site, setSite, tint]);
  const chatValue = useMemo(
    () => ({ open, setOpen, messages, send, orbState, streaming }),
    [open, messages, send, orbState, streaming]
  );

  return (
    <SiteContext.Provider value={siteValue}>
      <ChatContext.Provider value={chatValue}>
        <AppShell>{children}</AppShell>
      </ChatContext.Provider>
    </SiteContext.Provider>
  );
}
