"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FlaskConical, Gauge, LayoutDashboard, LineChart, Network, Radar, ScrollText, Sunrise } from "lucide-react";
import { Rail } from "@/components/rail";
import { SiteLogo } from "@/components/site-logo";
import { LiveTicker } from "@/components/live-ticker";
import { ChatLauncher, ChatPanel } from "@/components/chat-panel";
import { SeoOrb } from "@/components/seo-orb";
import { AmbientScene } from "@/components/ambient-scene";
import { useSite } from "@/components/providers";
import { SITES, SITE_ORDER } from "@/lib/sites";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/today", label: "Сегодня", Icon: Sunrise },
  { href: "/", label: "Дашборд", Icon: LayoutDashboard },
  { href: "/timeline", label: "Динамика", Icon: LineChart },
  { href: "/pult", label: "Пульт", Icon: Gauge },
  { href: "/nodes", label: "Узлы", Icon: Radar },
  { href: "/hypotheses", label: "Гипотезы", Icon: FlaskConical },
  { href: "/roy", label: "Рой", Icon: Network },
  { href: "/runs", label: "Сводки", Icon: ScrollText },
  { href: "/report", label: "Отчёт", Icon: FileText },
];

function MobileHeader() {
  const pathname = usePathname();
  const { site, setSite, tint } = useSite();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-base-2/70 backdrop-blur-xl lg:hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <SeoOrb size={32} state="idle" tint={tint} />
        <div className="font-display text-[15px] font-600 leading-none">Mr.Seo</div>
        <div className="ml-auto flex gap-2">
          {SITE_ORDER.map((k) => (
            <button
              key={k}
              onClick={() => setSite(k)}
              className="flex items-center justify-center"
              aria-label={SITES[k].label}
            >
              <SiteLogo site={k} size={26} active={k === site} glow={k === site} rounded="rounded-lg" />
            </button>
          ))}
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
        {NAV.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-none items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-500",
                active ? "bg-elev text-ink" : "text-faint"
              )}
            >
              <Icon size={14} /> {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AmbientScene />
      <div className="relative z-10 flex min-h-screen">
        <Rail />
        <div className="scene-veil min-w-0 flex-1">
          <MobileHeader />
          <main className="mx-auto w-full max-w-[1320px] px-5 py-9 pb-24 sm:px-9 lg:px-14 lg:py-14">
            {children}
          </main>
        </div>
      </div>
      <LiveTicker />
      <ChatLauncher />
      <ChatPanel />
    </>
  );
}
