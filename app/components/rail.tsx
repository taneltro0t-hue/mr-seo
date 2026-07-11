"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FlaskConical, Gauge, LayoutDashboard, LineChart, Network, Radar, ScrollText, Sunrise, UserCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SeoOrb } from "@/components/seo-orb";
import { SiteLogo } from "@/components/site-logo";
import { NotificationBell } from "@/components/notify-bell";
import { LangToggle } from "@/components/lang-toggle";
import { useSite } from "@/components/providers";
import { useApi } from "@/components/use-api";
import { useT } from "@/lib/i18n";
import { SITES, SITE_ORDER } from "@/lib/sites";
import type { AgentsResponse, TodayResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV: { href: string; labelKey: string; Icon: LucideIcon }[] = [
  { href: "/today", labelKey: "nav.today", Icon: Sunrise },
  { href: "/", labelKey: "nav.dashboard", Icon: LayoutDashboard },
  { href: "/timeline", labelKey: "nav.timeline", Icon: LineChart },
  { href: "/pult", labelKey: "nav.pult", Icon: Gauge },
  { href: "/nodes", labelKey: "nav.nodes", Icon: Radar },
  { href: "/hypotheses", labelKey: "nav.hypotheses", Icon: FlaskConical },
  { href: "/roy", labelKey: "nav.roy", Icon: Network },
  { href: "/runs", labelKey: "nav.runs", Icon: ScrollText },
  { href: "/report", labelKey: "nav.report", Icon: FileText },
  { href: "/account", labelKey: "nav.account", Icon: UserCircle2 },
];

/** Tooltip that flies out to the right of a rail control. */
function Flyout({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg border border-line bg-base-2/95 px-2.5 py-1.5 text-[12px] font-500 text-ink opacity-0 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100">
      {children}
    </span>
  );
}

/**
 * Minimal command rail — 72px. Icons + flyout tooltips, brand orb as the
 * persistent product character, site "channels" as HUD colour dots, roy pulse
 * at the base. Frees the whole stage for the scene.
 */
export function Rail() {
  const pathname = usePathname();
  const { site, setSite, tint } = useSite();
  const { t } = useT();
  const { data } = useApi<AgentsResponse>("/api/agents");
  const { data: today } = useApi<TodayResponse>("/api/today");
  const todayCount = today?.actions?.length ?? 0;
  const working = (data?.agents ?? []).filter((a) => a.status === "live").length;
  const anyError = (data?.agents ?? []).some((a) => a.status === "error");
  const royColor = anyError ? "#ff6b6b" : working > 0 ? "#4bd39a" : "#9aa5b2";

  return (
    <aside className="sticky top-0 z-30 hidden h-screen w-[72px] flex-none flex-col items-center overflow-y-auto border-r border-line bg-base-2/40 py-4 backdrop-blur-2xl lg:flex">
      {/* brand — persistent character */}
      <Link href="/" className="group relative flex flex-col items-center" aria-label="Mr.Seo">
        <SeoOrb size={38} state="idle" tint={tint} interactive />
        <span className="cap mt-2 text-[8px] tracking-[0.18em] text-ghost">MR.SEO</span>
        <Flyout>{t("nav.brand_home")}</Flyout>
      </Link>

      <div className="rule-x mt-5 w-8" />

      {/* nav */}
      <nav className="mt-4 flex flex-col items-center gap-1">
        {NAV.map(({ href, labelKey, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const badge = href === "/today" && todayCount > 0 ? todayCount : 0;
          const label = t(labelKey);
          return (
            <Link
              key={href}
              href={href}
              aria-label={badge ? t("nav.badge_actions", { label, count: badge }) : label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-ring group relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                active ? "bg-elev text-ink" : "text-faint hover:bg-white/[0.04] hover:text-ink"
              )}
            >
              <Icon size={18} strokeWidth={2} className={active ? "text-iris" : undefined} />
              {active && (
                <span className="absolute -left-[9px] top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-iris" />
              )}
              {badge > 0 && (
                <span className="mono absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-iris px-1 text-[9px] font-700 text-base-2 shadow-[0_0_10px_rgba(139,147,255,0.7)]">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
              <Flyout>{label}</Flyout>
            </Link>
          );
        })}
      </nav>

      {/* site channels — HUD switcher */}
      <div className="mt-auto flex flex-col items-center gap-2.5 pt-6">
        <span className="cap text-[8px] tracking-[0.16em] text-ghost">{t("nav.channel")}</span>
        {SITE_ORDER.map((k) => {
          const s = SITES[k];
          const on = k === site;
          return (
            <button
              key={k}
              onClick={() => setSite(k)}
              aria-label={s.label}
              aria-pressed={on}
              className="group relative flex h-9 w-9 items-center justify-center rounded-lg transition-transform hover:scale-110"
            >
              <SiteLogo site={k} size={32} active={on} glow={on} rounded="rounded-lg" />
              <Flyout>
                {s.label} · {s.region}
              </Flyout>
            </button>
          );
        })}

        <div className="rule-x mt-1 w-8" />
        {/* web-уведомления */}
        <NotificationBell />
        {/* roy pulse */}
        <div className="group relative flex h-8 w-8 items-center justify-center">
          <span className="warm-pulse h-2 w-2 rounded-full" style={{ background: royColor }} />
          <Flyout>
            {data
              ? t("nav.roy_working", { count: working }) + (anyError ? t("nav.roy_node_fail") : "")
              : t("nav.roy_connecting")}
          </Flyout>
        </div>

        {/* язык интерфейса */}
        <div className="rule-x mt-1 w-8" />
        <LangToggle className="pb-1" />
      </div>
    </aside>
  );
}
