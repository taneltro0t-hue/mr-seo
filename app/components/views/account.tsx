"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, LogOut, MailCheck, MonitorSmartphone, ShieldAlert, TerminalSquare } from "lucide-react";
import { SeoOrb } from "@/components/seo-orb";
import { Badge, CopyButton, FadeIn, PageHead, Panel, Skeleton } from "@/components/ui";
import { refreshCloud, useCloudStatus } from "@/components/cloud-status";
import { deviceId, sendMagicLink, signOut } from "@/lib/cloud";
import type { LicenseState } from "@/lib/cloud";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Дата по-русски: 21 июля 2026. */
function ruDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

/** Сколько дней осталось (для триала). null — если дата в прошлом/нет. */
function daysLeft(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  const diff = Math.ceil((d - Date.now()) / 86_400_000);
  return diff > 0 ? diff : null;
}

/* ------------------------------------------------------------------ */

export function AccountView() {
  const { state, loading } = useCloudStatus();

  return (
    <div className="space-y-10">
      <PageHead
        eyebrow="P2 · Облако Mr.Seo"
        title={<>Аккаунт</>}
        lede="Вход по ссылке из письма и лицензия устройства. Пока это мягкий контур — функции приложения работают без входа."
      />

      {loading || !state ? (
        <LoadingCard />
      ) : state.mode === "dev" ? (
        <DevCard />
      ) : state.mode === "anon" ? (
        <SignInHero />
      ) : state.mode === "expired" ? (
        <ExpiredCard state={state} />
      ) : (
        <LicensedCard state={state} />
      )}
    </div>
  );
}

/* --------------------------------- loading -------------------------------- */

function LoadingCard() {
  return (
    <Panel className="p-8">
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      <div className="rule-x my-7" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </Panel>
  );
}

/* ----------------------------------- dev ---------------------------------- */

function DevCard() {
  return (
    <FadeIn>
      <Panel className="hud-frame relative overflow-hidden p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl border border-line bg-white/[0.03] text-faint">
            <TerminalSquare size={20} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <div className="cap text-faint">Режим разработчика</div>
            <h2 className="mt-2 font-display text-[22px] font-500 leading-tight text-ink">
              Облако не настроено
            </h2>
            <p className="mt-2.5 max-w-xl text-[13.5px] leading-relaxed text-muted">
              Переменные Supabase не заданы, поэтому Mr.Seo работает локально без входа и лицензии.
              Всё разблокировано — удобно для разработки. Как только облако подключат, здесь появится
              форма входа.
            </p>
          </div>
        </div>
      </Panel>
    </FadeIn>
  );
}

/* -------------------------------- sign-in --------------------------------- */

function SignInHero() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // таймер «повторить через 60с»
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => window.clearInterval(t);
  }, [cooldown]);

  const valid = EMAIL_RE.test(email.trim());

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const addr = email.trim();
    if (!valid || sending || cooldown > 0) return;
    setSending(true);
    setError(null);
    const r = await sendMagicLink(addr);
    setSending(false);
    if (r.ok) {
      setSentTo(addr);
      setCooldown(60);
    } else {
      setError(r.error ?? "Не удалось отправить письмо");
    }
  }

  return (
    <FadeIn>
      <div className="mx-auto max-w-[560px]">
        <Panel className="relative overflow-hidden px-7 py-11 sm:px-11">
          {/* дышащее свечение позади орба — единственное на экран */}
          <div className="pointer-events-none absolute left-1/2 top-16 h-40 w-40 -translate-x-1/2 rounded-full bg-iris/20 blur-[70px]" />

          <div className="relative flex flex-col items-center text-center">
            <SeoOrb size={92} state={sending ? "thinking" : "idle"} tint="neutral" hero />

            {sentTo ? (
              <SentState sentTo={sentTo} cooldown={cooldown} onResend={submit} sending={sending} />
            ) : (
              <>
                <h2 className="mt-7 font-display text-[26px] font-500 leading-tight tracking-[-0.02em] text-ink">
                  Войдите в Mr.Seo
                </h2>
                <p className="mt-3 max-w-[380px] text-[13.5px] leading-relaxed text-muted">
                  Введите e-mail — пришлём ссылку для входа. Ни паролей, ни лишних полей.
                  При первом входе включаем пробный доступ на 14 дней.
                </p>

                <form onSubmit={submit} className="mt-7 w-full max-w-[380px] space-y-3 text-left">
                  <label className="block">
                    <span className="cap mb-2 block text-ghost">E-mail</span>
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoFocus
                      value={email}
                      onChange={(ev) => {
                        setEmail(ev.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="you@studio.ru"
                      aria-invalid={error ? true : undefined}
                      className={cn(
                        "focus-ring w-full rounded-xl border border-line bg-white/[0.03] px-4 py-3 text-[14px] text-ink placeholder:text-ghost transition-colors",
                        "hover:border-line-strong focus:border-iris/50",
                        error && "border-warn/45"
                      )}
                    />
                  </label>

                  {error && (
                    <p className="text-[12.5px] leading-snug text-warn" role="alert">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={!valid || sending}
                    className={cn(
                      "focus-ring group flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-600 transition-all",
                      valid && !sending
                        ? "bg-iris text-base shadow-[0_10px_40px_-12px_rgba(139,147,255,0.75)] hover:bg-iris-deep"
                        : "cursor-not-allowed border border-line bg-white/[0.02] text-ghost"
                    )}
                  >
                    {sending ? "Отправляем…" : "Получить ссылку"}
                    {!sending && (
                      <ArrowRight
                        size={16}
                        strokeWidth={2.25}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </Panel>

        <p className="mt-5 text-center text-[11.5px] leading-relaxed text-ghost">
          Продолжая, вы соглашаетесь с условиями использования Mr.Seo.
        </p>
      </div>
    </FadeIn>
  );
}

function SentState({
  sentTo,
  cooldown,
  onResend,
  sending,
}: {
  sentTo: string;
  cooldown: number;
  onResend: () => void;
  sending: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center"
    >
      <span className="mt-7 inline-flex items-center gap-2 rounded-full border border-good/25 bg-good/10 px-3 py-1 text-good">
        <MailCheck size={14} />
        <span className="cap text-good">Письмо отправлено</span>
      </span>

      <h2 className="mt-5 font-display text-[24px] font-500 leading-tight tracking-[-0.02em] text-ink">
        Проверьте почту
      </h2>
      <p className="mt-3 max-w-[400px] text-[13.5px] leading-relaxed text-muted">
        Ссылка для входа ушла на{" "}
        <span className="font-600 text-ink">{sentTo}</span>. Откройте её в этом браузере — вы
        вернётесь сюда уже войдя.
      </p>

      <div className="mt-7 flex items-center gap-3">
        <button
          type="button"
          onClick={onResend}
          disabled={cooldown > 0 || sending}
          className={cn(
            "focus-ring rounded-xl border border-line px-4 py-2.5 text-[13px] font-500 transition-colors",
            cooldown > 0 || sending
              ? "cursor-not-allowed text-ghost"
              : "text-muted hover:bg-white/[0.05] hover:text-ink"
          )}
        >
          {sending
            ? "Отправляем…"
            : cooldown > 0
              ? `Повторить через ${cooldown} с`
              : "Отправить ещё раз"}
        </button>
      </div>
    </motion.div>
  );
}

/* ------------------------------- licensed --------------------------------- */

function LicensedCard({ state }: { state: LicenseState }) {
  const [device, setDevice] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setDevice(deviceId());
    } catch {
      /* localStorage недоступен */
    }
  }, []);

  const planRaw = (state.plan ?? "trial").toLowerCase();
  const isPro = planRaw.includes("pro");
  const planLabel = isPro ? "PRO" : "TRIAL";
  const left = isPro ? null : daysLeft(state.expiresAt);
  const shortDevice = device ? device.replace(/-/g, "").slice(0, 12) : "…";

  async function doSignOut() {
    setBusy(true);
    await signOut();
    await refreshCloud();
    setBusy(false);
  }

  return (
    <FadeIn>
      <Panel className="relative overflow-hidden">
        {/* верхняя лента: орб + e-mail + план */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-4 p-8">
          <SeoOrb size={56} state="idle" tint={isPro ? "good" : "ok"} />
          <div className="min-w-0 flex-1">
            <div className="cap text-ghost">Вы вошли как</div>
            <div className="mt-1.5 truncate font-display text-[20px] font-500 text-ink">
              {state.email || "—"}
            </div>
          </div>
          <Badge tone={isPro ? "good" : "ok"} className="px-3 py-1 text-[12px]">
            <span className="mono tracking-[0.14em]">{planLabel}</span>
          </Badge>
        </div>

        <div className="rule-x" />

        {/* поля */}
        <div className="grid gap-px bg-line sm:grid-cols-2">
          <Field label="Лицензия действует до">
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-600 text-ink">{ruDate(state.expiresAt)}</span>
              {left != null && (
                <span className="mono text-[11px] text-faint">осталось {left} дн.</span>
              )}
            </div>
          </Field>

          <Field label="Это устройство" icon={<MonitorSmartphone size={13} />}>
            <div className="flex items-center gap-2.5">
              <span className="mono truncate text-[13px] text-muted">{shortDevice}</span>
              {device && <CopyButton value={device} label="ID" className="px-2 py-1" />}
            </div>
          </Field>
        </div>

        <div className="rule-x" />

        <div className="flex items-center justify-between gap-4 p-6">
          <p className="text-[12px] leading-relaxed text-faint">
            Лицензия привязана к этому устройству. Выход отвяжет его до следующего входа.
          </p>
          <button
            type="button"
            onClick={doSignOut}
            disabled={busy}
            className="focus-ring flex flex-none items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-[13px] font-500 text-muted transition-colors hover:border-warn/40 hover:bg-warn/5 hover:text-warn disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut size={15} />
            {busy ? "Выходим…" : "Выйти"}
          </button>
        </div>
      </Panel>
    </FadeIn>
  );
}

/* -------------------------------- expired --------------------------------- */

function ExpiredCard({ state }: { state: LicenseState }) {
  const [busy, setBusy] = useState(false);

  async function doSignOut() {
    setBusy(true);
    await signOut();
    await refreshCloud();
    setBusy(false);
  }

  return (
    <FadeIn>
      <Panel className="relative overflow-hidden p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl border border-warn/25 bg-warn/10 text-warn">
            <ShieldAlert size={20} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <div className="cap text-warn">Доступ приостановлен</div>
            <h2 className="mt-2 font-display text-[22px] font-500 leading-tight text-ink">
              Лицензия истекла
            </h2>
            <p className="mt-2.5 max-w-xl text-[13.5px] leading-relaxed text-muted">
              Срок доступа для{" "}
              <span className="font-600 text-ink">{state.email || "вашего аккаунта"}</span> закончился
              {state.expiresAt ? ` ${ruDate(state.expiresAt)}` : ""}. Чтобы продлить — напишите нам, и
              мы вернём доступ.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-4 py-2.5 text-[13px] text-faint">
                {/* плейсхолдер контакта — заполнится в P3 */}
                Напишите нам: <span className="text-ghost">контакт скоро появится</span>
              </span>
              <button
                type="button"
                onClick={doSignOut}
                disabled={busy}
                className="focus-ring flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-[13px] font-500 text-muted transition-colors hover:bg-white/[0.05] hover:text-ink disabled:opacity-60"
              >
                <LogOut size={15} />
                {busy ? "Выходим…" : "Выйти"}
              </button>
            </div>
          </div>
        </div>
      </Panel>
    </FadeIn>
  );
}

/* --------------------------------- shared --------------------------------- */

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-panel px-8 py-6">
      <div className="cap flex items-center gap-1.5 text-ghost">
        {icon}
        {label}
      </div>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}
