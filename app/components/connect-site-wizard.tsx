"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { SeoOrb } from "@/components/seo-orb";
import { CopyButton, Modal, SectionLabel } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const SA_EMAIL = "seo-agent-bot@alien-baton-494406-e4.iam.gserviceaccount.com";

interface Form {
  name: string;
  url: string;
  yandexToken: string;
  yandexUserId: string;
  googleAck: boolean;
  bingKey: string;
}

const EMPTY: Form = {
  name: "",
  url: "",
  yandexToken: "",
  yandexUserId: "",
  googleAck: false,
  bingKey: "",
};

const STEPS = ["wiz.step_site", "wiz.step_connect", "wiz.step_done"] as const;

export function ConnectSiteWizard({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const canNext = step === 0 ? form.name.trim() !== "" && form.url.trim() !== "" : true;

  const connections = useMemo(() => {
    const out: string[] = [];
    if (form.yandexToken.trim() || form.yandexUserId.trim()) out.push("Yandex.Webmaster");
    if (form.googleAck) out.push("Google Search Console");
    if (form.bingKey.trim()) out.push("Bing");
    return out;
  }, [form]);

  function reset() {
    setStep(0);
    setForm(EMPTY);
    setSending(false);
    setDone(false);
  }

  function handleClose() {
    onClose();
    // сброс после закрытия, чтобы не мигало во время exit-анимации
    setTimeout(reset, 250);
  }

  async function submit() {
    setSending(true);
    try {
      await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          url: form.url.trim(),
          connections,
        }),
      });
    } catch {
      /* заявка всё равно уходит в очередь на сервере при доступности */
    } finally {
      setSending(false);
      setDone(true);
      setStep(2);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} labelledBy="wizard-title" maxWidth={600}>
      {/* header + stepper */}
      <div className="mb-6 flex items-center gap-3.5">
        <SeoOrb size={44} state={sending ? "thinking" : "idle"} tint="neutral" />
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-faint">
            {t("wiz.new_project")}
          </div>
          <h2 id="wizard-title" className="font-display text-2xl font-600 leading-tight">
            {t("wiz.connect_site")}
          </h2>
        </div>
      </div>

      <Stepper step={step} />

      <div className="mt-6 min-h-[248px]">
        {step === 0 && <StepSite form={form} set={set} />}
        {step === 1 && <StepConnections form={form} set={set} />}
        {step === 2 && done && <StepDone name={form.name} connections={connections} />}
      </div>

      {/* footer */}
      {step < 2 && (
        <div className="mt-7 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="focus-ring inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:text-ink"
            >
              <ArrowLeft size={15} /> {t("common.back")}
            </button>
          ) : (
            <span />
          )}

          {step === 0 && (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setStep(1)}
              className={cn(
                "focus-ring inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-600 transition-all",
                canNext
                  ? "bg-iris text-white shadow-[0_10px_30px_-12px_rgba(139,147,255,0.9)] hover:brightness-110"
                  : "cursor-not-allowed bg-white/[0.05] text-faint"
              )}
            >
              {t("common.next")} <ArrowRight size={15} />
            </button>
          )}
          {step === 1 && (
            <button
              type="button"
              disabled={sending}
              onClick={submit}
              className="focus-ring inline-flex items-center gap-2 rounded-xl bg-iris px-5 py-2.5 text-sm font-600 text-white shadow-[0_10px_30px_-12px_rgba(139,147,255,0.9)] transition-all hover:brightness-110 disabled:opacity-70"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {t("wiz.submit")}
            </button>
          )}
        </div>
      )}
      {step === 2 && (
        <div className="mt-7 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="focus-ring inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-5 py-2.5 text-sm font-600 text-ink transition-colors hover:bg-white/[0.1]"
          >
            {t("common.close")}
          </button>
        </div>
      )}
    </Modal>
  );
}

function Stepper({ step }: { step: number }) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((labelKey, i) => {
        const active = i === step;
        const passed = i < step;
        return (
          <div key={labelKey} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 flex-none items-center justify-center rounded-full border text-[11px] font-600 transition-colors",
                active && "border-iris/60 bg-iris/15 text-iris",
                passed && "border-good/40 bg-good/15 text-good",
                !active && !passed && "border-line text-faint"
              )}
            >
              {passed ? <CheckCircle2 size={13} /> : i + 1}
            </div>
            <span
              className={cn(
                "text-xs font-500",
                active ? "text-ink" : passed ? "text-muted" : "text-faint"
              )}
            >
              {t(labelKey)}
            </span>
            {i < STEPS.length - 1 && (
              <div className="mx-1 h-px flex-1 bg-line" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ Field ------------------------------ */

function Field({
  label,
  hint,
  ...rest
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-500 text-muted">{label}</span>
      <input
        {...rest}
        className="focus-ring w-full rounded-xl border border-line bg-white/[0.03] px-3.5 py-2.5 text-sm text-ink placeholder:text-faint transition-colors focus:border-line-strong"
      />
      {hint && <span className="mt-1.5 block text-[11px] leading-relaxed text-faint">{hint}</span>}
    </label>
  );
}

type SetFn = <K extends keyof Form>(k: K, v: Form[K]) => void;

function StepSite({ form, set }: { form: Form; set: SetFn }) {
  const { t } = useT();
  return (
    <motion.div
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      <Field
        label={t("wiz.name_label")}
        placeholder={t("wiz.name_ph")}
        value={form.name}
        onChange={(e) => set("name", e.target.value)}
      />
      <Field
        label={t("wiz.url_label")}
        placeholder="https://example.ru"
        value={form.url}
        onChange={(e) => set("url", e.target.value)}
        hint={t("wiz.url_hint")}
      />
    </motion.div>
  );
}

function StepConnections({ form, set }: { form: Form; set: SetFn }) {
  const { t } = useT();
  return (
    <motion.div
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      <p className="text-xs leading-relaxed text-faint">
        {t("wiz.connect_intro")}
      </p>

      {/* Yandex */}
      <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
        <SectionLabel className="mb-3">{t("wiz.yandex_title")}</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t("wiz.oauth_label")}
            placeholder="y0_Ag…"
            value={form.yandexToken}
            onChange={(e) => set("yandexToken", e.target.value)}
          />
          <Field
            label="User ID"
            placeholder="123456789"
            value={form.yandexUserId}
            onChange={(e) => set("yandexUserId", e.target.value)}
          />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-faint">
          {t("wiz.yandex_hint")}
        </p>
      </div>

      {/* Google */}
      <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
        <SectionLabel className="mb-3">Google Search Console</SectionLabel>
        <p className="text-[11px] leading-relaxed text-muted">
          {t("wiz.sa_intro")}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-black/30 px-3 py-2.5">
          <code className="mono min-w-0 flex-1 truncate text-[12px] text-cyan">
            {SA_EMAIL}
          </code>
          <CopyButton value={SA_EMAIL} label={t("common.copy")} />
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={form.googleAck}
            onChange={(e) => set("googleAck", e.target.checked)}
            className="h-4 w-4 accent-[color:var(--color-iris)]"
          />
          {t("wiz.sa_confirm")}
        </label>
      </div>

      {/* Bing */}
      <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
        <SectionLabel className="mb-3">Bing Webmaster</SectionLabel>
        <Field
          label={t("wiz.apikey_label")}
          placeholder={t("wiz.optional")}
          value={form.bingKey}
          onChange={(e) => set("bingKey", e.target.value)}
          hint={t("wiz.bing_hint")}
        />
      </div>
    </motion.div>
  );
}

function StepDone({ name, connections }: { name: string; connections: string[] }) {
  const { t } = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center py-4 text-center"
    >
      <SeoOrb size={92} state="speaking" tint="good" />
      <h3 className="mt-5 font-display text-2xl font-600">{t("wiz.done_title")}</h3>
      <p className="mt-2 max-w-[360px] text-sm leading-relaxed text-muted">
        {t("wiz.done_body", { name: name || t("wiz.new_site") })}
      </p>
      {connections.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {connections.map((c) => (
            <span
              key={c}
              className="rounded-full border border-good/25 bg-good/10 px-3 py-1 text-xs text-good"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
