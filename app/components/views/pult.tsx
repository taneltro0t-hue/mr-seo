"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  ExternalLink,
  KeyRound,
  RefreshCw,
  RotateCw,
  Send,
  Zap,
} from "lucide-react";
import { useSite } from "@/components/providers";
import { useT } from "@/lib/i18n";
import { SiteLogo } from "@/components/site-logo";
import { PageHead, SectionIntro, Skeleton, ToneDot } from "@/components/ui";
import { cabinetGroups } from "@/lib/ecosystem";
import { SITES, SITE_ORDER } from "@/lib/sites";
import type {
  OpsAiBots,
  OpsQuota,
  OpsResult,
  OpsStatus,
  OpsTokenState,
  SiteKey,
  Tone,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------ ops client ------------------------------ */

async function postOps<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/ops", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

/* -------------------------------- buttons -------------------------------- */

function PrimaryBtn({
  children,
  onClick,
  disabled,
  pending,
  Icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
  Icon: typeof Send;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className="focus-ring inline-flex items-center gap-2 rounded-xl bg-iris px-4 py-2.5 text-sm font-600 text-white shadow-[0_12px_34px_-14px_rgba(139,147,255,0.95)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Icon size={15} className={pending ? "animate-spin" : undefined} />
      {children}
    </button>
  );
}

function GhostBtn({
  children,
  onClick,
  disabled,
  pending,
  Icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
  Icon: typeof Send;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className="focus-ring inline-flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-3.5 py-2.5 text-sm font-500 text-muted transition-colors hover:bg-white/[0.07] hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Icon size={15} className={pending ? "animate-spin" : undefined} />
      {children}
    </button>
  );
}

/* ------------------------------- directive ------------------------------- */

/** Инлайн-результат операции в стиле директив: mono, тон-точка, моноширинный. */
function Directive({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const border = tone === "good" ? "border-good/25" : tone === "ok" ? "border-ok/25" : "border-warn/25";
  const bg = tone === "good" ? "bg-good/[0.06]" : tone === "ok" ? "bg-ok/[0.06]" : "bg-warn/[0.06]";
  const text = tone === "good" ? "text-good" : tone === "ok" ? "text-ok" : "text-warn";
  return (
    <div className={cn("mt-4 flex items-start gap-3 rounded-xl border px-4 py-3", border, bg)}>
      <ToneDot tone={tone} className="mt-1.5" />
      <div className={cn("mono min-w-0 flex-1 text-[12.5px] leading-relaxed", text)}>{children}</div>
    </div>
  );
}

/* ---------------------------- site channel bar ---------------------------- */

function ChannelBar({ site, onPick }: { site: SiteKey; onPick: (s: SiteKey) => void }) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="cap mr-1 text-ghost">{t("pult.channel")}</span>
      {SITE_ORDER.map((k) => {
        const s = SITES[k];
        const on = k === site;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onPick(k)}
            aria-pressed={on}
            className={cn(
              "focus-ring group inline-flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors",
              on ? "bg-elev text-ink" : "border-line text-faint hover:bg-white/[0.04] hover:text-ink"
            )}
            style={on ? { borderColor: `${s.accent}55` } : undefined}
          >
            <SiteLogo site={k} size={26} active={on} glow={on} />
            <span className="text-left leading-tight">
              <span className="block text-[13px] font-600">{s.label}</span>
              <span className="block text-[10px] text-faint">{s.region}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ================================ view ================================ */

export function PultView() {
  const { site, setSite } = useSite();
  const { t } = useT();

  return (
    <div className="space-y-14">
      <PageHead
        eyebrow={t("pult.eyebrow")}
        title={t("nav.pult")}
        lede={t("pult.lede")}
      />

      <TokensSection />

      <div className="rule-x" />

      <ChannelBar site={site} onPick={setSite} />

      <RecrawlSection site={site} />
      <AiAccessSection site={site} />
      <CabinetsSection site={site} />
    </div>
  );
}

/* --------------------------- 1. Токены и ключи --------------------------- */

const TOKEN_ROWS: { key: keyof Omit<OpsStatus, "checked_at">; nameKey: string; kind: string }[] = [
  { key: "gsc_sa", nameKey: "pult.tok_gsc_sa", kind: "Google" },
  { key: "gsc_oauth", nameKey: "pult.tok_gsc_oauth", kind: "Google" },
  { key: "yandex", nameKey: "pult.tok_yandex", kind: "Yandex" },
  { key: "bing", nameKey: "pult.tok_bing", kind: "Bing" },
];

function TokensSection() {
  const { t, lang } = useT();
  const [status, setStatus] = useState<OpsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [reauth, setReauth] = useState<{ pending: boolean; msg: OpsResult | null }>({
    pending: false,
    msg: null,
  });
  const [bingOpen, setBingOpen] = useState(false);
  const [bingKey, setBingKey] = useState("");
  const [bing, setBing] = useState<{ pending: boolean; msg: OpsResult | null }>({
    pending: false,
    msg: null,
  });

  const load = useCallback(async (manual = false) => {
    if (manual) setChecking(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/ops");
      const data = (await res.json()) as OpsStatus;
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const doReauth = useCallback(async () => {
    setReauth({ pending: true, msg: null });
    const res = await postOps<OpsResult>({ action: "gsc_reauth" });
    setReauth({ pending: false, msg: res });
  }, []);

  const validBing = /^[A-Za-z0-9-]{16,128}$/.test(bingKey.trim());
  const saveBing = useCallback(async () => {
    const key = bingKey.trim();
    if (!/^[A-Za-z0-9-]{16,128}$/.test(key)) {
      setBing({ pending: false, msg: { ok: false, error: t("pult.bing_key_rule") } });
      return;
    }
    setBing({ pending: true, msg: null });
    const res = await postOps<OpsResult>({ action: "set_bing_key", key });
    setBing({ pending: false, msg: res });
    if (res.ok) {
      setBingKey("");
      void load(true);
    }
  }, [bingKey, load, t]);

  return (
    <section>
      <SectionIntro
        index="01"
        eyebrow={t("pult.tokens_eyebrow")}
        title={t("pult.tokens_title")}
        note={t("pult.tokens_note")}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <GhostBtn onClick={() => load(true)} pending={checking} Icon={RefreshCw}>
          {t("pult.check_now")}
        </GhostBtn>
        {status?.checked_at && (
          <span className="cap text-ghost">
            {t("pult.polled_at", { time: new Date(status.checked_at).toLocaleString(lang === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) })}
          </span>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {loading || !status
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[76px]" />)
          : TOKEN_ROWS.map((row) => {
              const st = status[row.key];
              const isOauth = row.key === "gsc_oauth";
              const isBing = row.key === "bing";
              return (
                <div key={row.key}>
                  <TokenRow
                    name={t(row.nameKey)}
                    kind={row.kind}
                    state={st}
                    perpetual={row.key === "gsc_sa"}
                    action={
                      isOauth ? (
                        <GhostBtn onClick={doReauth} pending={reauth.pending} Icon={RotateCw}>
                          {t("pult.reissue")}
                        </GhostBtn>
                      ) : isBing ? (
                        <GhostBtn
                          onClick={() => setBingOpen((o) => !o)}
                          Icon={KeyRound}
                        >
                          {t("common.update_key")}
                        </GhostBtn>
                      ) : undefined
                    }
                  />
                  {isOauth && reauth.msg && (
                    <Directive tone={reauth.msg.ok ? "good" : "warn"}>
                      {reauth.msg.ok
                        ? reauth.msg.note ?? t("pult.reauth_ok_fallback")
                        : reauth.msg.error ?? t("pult.reauth_fail_fallback")}
                    </Directive>
                  )}
                  {isBing && bingOpen && (
                    <div className="surface-line mt-3 space-y-4 p-5">
                      <a
                        href="https://www.bing.com/webmasters"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="focus-ring group inline-flex items-center gap-2 rounded-lg text-[13px] text-muted transition-colors hover:text-ink"
                      >
                        <ExternalLink size={14} className="flex-none text-faint group-hover:text-iris" />
                        {t("pult.bing_get_key")}
                      </a>
                      <p className="cap text-ghost">Settings → API access</p>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <input
                          type="text"
                          inputMode="text"
                          autoComplete="off"
                          spellCheck={false}
                          value={bingKey}
                          onChange={(e) => setBingKey(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && validBing && !bing.pending) saveBing();
                          }}
                          placeholder={t("pult.bing_placeholder")}
                          className="focus-ring mono w-full flex-1 rounded-xl border border-line bg-black/40 px-4 py-3 text-[13px] text-ink placeholder:text-ghost"
                        />
                        <PrimaryBtn
                          onClick={saveBing}
                          disabled={!validBing}
                          pending={bing.pending}
                          Icon={KeyRound}
                        >
                          {t("pult.save_and_check")}
                        </PrimaryBtn>
                      </div>
                      {bing.msg && (
                        <Directive tone={bing.msg.ok ? "good" : "warn"}>
                          <span className="opacity-60">{t("pult.bing_key_arrow")}</span>
                          {bing.msg.ok
                            ? bing.msg.note ?? t("pult.bing_saved")
                            : bing.msg.error ?? t("pult.bing_save_fail")}
                        </Directive>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
      </div>
    </section>
  );
}

function TokenRow({
  name,
  kind,
  state,
  perpetual,
  action,
}: {
  name: string;
  kind: string;
  state: OpsTokenState;
  perpetual?: boolean;
  action?: React.ReactNode;
}) {
  const { t } = useT();
  const tone: Tone = state.ok ? "good" : "warn";
  return (
    <div className="surface-line flex items-center gap-4 px-5 py-4">
      <ToneDot tone={tone} />
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-line bg-white/[0.02]">
        <KeyRound size={15} className={state.ok ? "text-good" : "text-warn"} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-600">{name}</span>
          {perpetual && (
            <span className="cap rounded-full border border-line px-2 py-0.5 text-[9px] text-faint">
              {t("pult.perpetual")}
            </span>
          )}
        </div>
        <div className={cn("mt-1 truncate text-[12px]", state.ok ? "text-muted" : "text-warn")}>
          {state.ok ? state.note ?? t("pult.online") : state.error ?? t("pult.offline")}
        </div>
      </div>
      {action}
      <span className="cap hidden flex-none text-ghost sm:inline">{kind}</span>
    </div>
  );
}

/* ----------------------------- 2. Переобход ----------------------------- */

function RecrawlSection({ site }: { site: SiteKey }) {
  const { t } = useT();
  const [quota, setQuota] = useState<OpsQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [recrawl, setRecrawl] = useState<{ pending: boolean; msg: OpsResult | null }>({
    pending: false,
    msg: null,
  });
  const [indexnow, setIndexnow] = useState<{ pending: boolean; msg: OpsResult | null }>({
    pending: false,
    msg: null,
  });
  const reqId = useRef(0);

  const loadQuota = useCallback(async (s: SiteKey) => {
    const id = ++reqId.current;
    setQuotaLoading(true);
    const res = await postOps<OpsQuota>({ action: "recrawl_quota", site: s });
    if (id === reqId.current) {
      setQuota(res);
      setQuotaLoading(false);
    }
  }, []);

  useEffect(() => {
    setRecrawl({ pending: false, msg: null });
    setIndexnow({ pending: false, msg: null });
    void loadQuota(site);
  }, [site, loadQuota]);

  const validUrl = /^https?:\/\/.+/.test(url.trim());

  const doRecrawl = useCallback(async () => {
    if (!validUrl) return;
    setRecrawl({ pending: true, msg: null });
    const res = await postOps<OpsResult>({ action: "recrawl", site, url: url.trim() });
    setRecrawl({ pending: false, msg: res });
    void loadQuota(site);
  }, [site, url, validUrl, loadQuota]);

  const doIndexnow = useCallback(async () => {
    if (!validUrl) return;
    setIndexnow({ pending: true, msg: null });
    const res = await postOps<OpsResult>({ action: "indexnow", site, url: url.trim() });
    setIndexnow({ pending: false, msg: res });
  }, [site, url, validUrl]);

  const remainder = quota?.ok ? quota.remainder ?? 0 : null;
  const daily = quota?.ok ? quota.daily_quota ?? 0 : null;
  const pct = remainder != null && daily ? Math.round((remainder / daily) * 100) : 0;

  return (
    <section>
      <SectionIntro
        index="02"
        eyebrow={t("pult.recrawl_eyebrow")}
        title={t("pult.recrawl_title")}
        note={t("pult.recrawl_note")}
      />

      <div className="surface-hero glass mt-6 overflow-hidden p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-10">
          {/* live quota */}
          <div className="flex flex-col justify-between gap-5 lg:border-r lg:border-line lg:pr-8">
            <div>
              <div className="cap">{t("pult.quota_remainder")}</div>
              <div className="mt-3 flex items-end gap-2">
                {quotaLoading ? (
                  <Skeleton className="h-[46px] w-24" />
                ) : (
                  <>
                    <span className="hero-num text-[52px]" style={{ color: "var(--color-iris)" }}>
                      {remainder ?? "—"}
                    </span>
                    {daily != null && <span className="mono mb-2 text-sm text-faint">/ {daily}</span>}
                  </>
                )}
              </div>
              {!quotaLoading && (
                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--color-iris), var(--color-cyan))" }}
                  />
                </div>
              )}
            </div>
            {!quotaLoading && quota && !quota.ok && (
              <div className="mono text-[11px] text-warn">{quota.error ?? t("pult.quota_unavailable")}</div>
            )}
          </div>

          {/* url + actions */}
          <div>
            <label className="cap block">{t("pult.url_label")}</label>
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={`https://${SITES[site].domain}/…`}
              className="focus-ring mono mt-3 w-full rounded-xl border border-line bg-black/40 px-4 py-3.5 text-[13.5px] text-ink placeholder:text-ghost"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <PrimaryBtn onClick={doRecrawl} disabled={!validUrl} pending={recrawl.pending} Icon={Send}>
                {t("pult.send_recrawl")}
              </PrimaryBtn>
              <GhostBtn onClick={doIndexnow} disabled={!validUrl} pending={indexnow.pending} Icon={Zap}>
                + IndexNow
              </GhostBtn>
              {!validUrl && url.length > 0 && (
                <span className="mono text-[11px] text-faint">{t("pult.need_full_url")}</span>
              )}
            </div>

            {recrawl.msg && (
              <Directive tone={recrawl.msg.ok ? "good" : "warn"}>
                <span className="opacity-60">recrawl · yandex → </span>
                {recrawl.msg.ok ? recrawl.msg.note ?? t("pult.recrawl_accepted") : recrawl.msg.error ?? t("pult.recrawl_rejected")}
              </Directive>
            )}
            {indexnow.msg && (
              <Directive tone={indexnow.msg.ok ? "good" : "ok"}>
                <span className="opacity-60">indexnow → </span>
                {indexnow.msg.ok ? indexnow.msg.note ?? t("pult.indexnow_sent") : indexnow.msg.error ?? t("pult.indexnow_no_key")}
              </Directive>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- 3. AI-доступ ----------------------------- */

function AiAccessSection({ site }: { site: SiteKey }) {
  const { t } = useT();
  const [res, setRes] = useState<OpsAiBots | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setRes(null);
  }, [site]);

  const check = useCallback(async () => {
    setPending(true);
    const r = await postOps<OpsAiBots>({ action: "aibots", site });
    setRes(r);
    setPending(false);
  }, [site]);

  return (
    <section>
      <SectionIntro
        index="03"
        eyebrow={t("pult.ai_eyebrow")}
        title={t("pult.ai_title")}
        note={t("pult.ai_note")}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <PrimaryBtn onClick={check} pending={pending} Icon={Bot}>
          {t("pult.check_ai")}
        </PrimaryBtn>
        <span className="cap text-ghost">{t("pult.channel_of", { label: SITES[site].label })}</span>
      </div>

      {res && (
        <div className="surface-line mt-5 p-5">
          {res.ok ? (
            <>
              <div
                className={cn(
                  "mono mb-4 flex items-center gap-2 text-[12.5px]",
                  res.blocked && res.blocked.length > 0 ? "text-warn" : "text-good"
                )}
              >
                <ToneDot tone={res.blocked && res.blocked.length > 0 ? "warn" : "good"} />
                {res.note}
              </div>
              <div className="flex flex-wrap gap-2">
                {(res.checked ?? []).map((bot) => {
                  const blocked = (res.blocked ?? []).some(
                    (b) => b.toLowerCase() === bot.toLowerCase() || b.startsWith("*")
                  );
                  return (
                    <span
                      key={bot}
                      className={cn(
                        "mono inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px]",
                        blocked
                          ? "border-warn/40 bg-warn/[0.08] text-warn"
                          : "border-good/25 bg-good/[0.05] text-good/90"
                      )}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: blocked ? "#ff6b6b" : "#4bd39a" }}
                      />
                      {bot}
                    </span>
                  );
                })}
                {(res.blocked ?? [])
                  .filter((b) => b.startsWith("*"))
                  .map((b) => (
                    <span
                      key={b}
                      className="mono inline-flex items-center gap-1.5 rounded-lg border border-warn/50 bg-warn/[0.12] px-2.5 py-1.5 text-[11.5px] text-warn"
                    >
                      {b}
                    </span>
                  ))}
              </div>
            </>
          ) : (
            <Directive tone="warn">{res.error ?? t("pult.robots_fail")}</Directive>
          )}
        </div>
      )}
    </section>
  );
}

/* ----------------------------- 4. Кабинеты ----------------------------- */

function CabinetsSection({ site }: { site: SiteKey }) {
  const { t } = useT();
  const groups = cabinetGroups(site);
  return (
    <section>
      <SectionIntro
        index="04"
        eyebrow={t("pult.cab_eyebrow")}
        title={t("pult.cab_title")}
        note={t("pult.cab_note")}
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <div key={g.service} className="surface-line flex flex-col p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[13.5px] font-600 text-ink">{g.title}</span>
              <span className="cap text-ghost">{g.service}</span>
            </div>
            <div className="space-y-1.5">
              {g.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-muted transition-colors hover:bg-white/[0.05] hover:text-ink"
                >
                  <ExternalLink size={14} className="flex-none text-faint group-hover:text-iris" />
                  <span className="min-w-0 flex-1 truncate">{l.label}</span>
                  {l.unverified && <span className="mono flex-none text-[11px] text-ok/80">⚠</span>}
                </a>
              ))}
            </div>
            {g.emptyNote && (
              <div className="mono mt-3 border-t border-line pt-3 text-[10.5px] text-ghost">
                {g.emptyNote}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
