"use client";

import { useState } from "react";
import { Bot, Compass, Globe, Plus, Search, Star, type LucideIcon } from "lucide-react";
import { useApi } from "@/components/use-api";
import { ConnectSiteWizard } from "@/components/connect-site-wizard";
import { SiteLogo } from "@/components/site-logo";
import { PageHead, Skeleton, Stagger, StaggerItem } from "@/components/ui";
import type { DataNode, NodeKind, NodesResponse, NodeState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const ICONS: Record<NodeKind, LucideIcon> = {
  yandex: Search,
  google: Globe,
  bing: Compass,
  reputation: Star,
  llm: Bot,
};

const STATE_COLOR: Record<NodeState, string> = {
  live: "#4bd39a",
  error: "#ff6b6b",
  idle: "#5a6472",
};

// значения — ключи i18n, резолвятся через t() на рендере
const STATE_LABEL: Record<NodeState, string> = {
  live: "nodes.state_live",
  error: "nodes.state_error",
  idle: "nodes.state_idle",
};

export function NodesView() {
  const { data, loading } = useApi<NodesResponse>("/api/nodes");
  const [wizard, setWizard] = useState(false);

  return (
    <div className="space-y-12">
      <Header onConnect={() => setWizard(true)} />

      {loading || !data ? (
        <NodesSkeleton />
      ) : (
        <div className="space-y-12">
          {data.groups.map((g, gi) => (
            <section key={g.site.key}>
              <div className="mb-5 flex items-center gap-3">
                <SiteLogo site={g.site.key} size={34} rounded="rounded-xl" />
                <div>
                  <div className="font-display text-xl font-600 leading-none">
                    {g.site.label}
                  </div>
                  <div className="mt-1 text-[11px] text-faint">
                    {g.site.region} · {g.site.domain}
                  </div>
                </div>
                <div className="ml-auto text-xs text-faint">
                  <LiveCount nodes={g.nodes} />
                </div>
              </div>
              <Stagger
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                step={0.05}
                delay={gi * 0.04}
              >
                {g.nodes.map((n) => (
                  <StaggerItem key={n.kind}>
                    <NodeCard node={n} accent={g.site.accent} />
                  </StaggerItem>
                ))}
              </Stagger>
            </section>
          ))}
        </div>
      )}

      <ConnectSiteWizard open={wizard} onClose={() => setWizard(false)} />
    </div>
  );
}

function Header({ onConnect }: { onConnect: () => void }) {
  const { t } = useT();
  return (
    <PageHead
      eyebrow={t("nodes.eyebrow")}
      title={t("nav.nodes")}
      lede={t("nodes.lede")}
      right={
        <button
          type="button"
          onClick={onConnect}
          className="focus-ring inline-flex items-center gap-2 rounded-xl bg-iris px-4 py-2.5 text-sm font-600 text-white shadow-[0_12px_34px_-14px_rgba(139,147,255,0.95)] transition-all hover:brightness-110"
        >
          <Plus size={16} /> {t("nodes.connect_site")}
        </button>
      }
    />
  );
}

function LiveCount({ nodes }: { nodes: DataNode[] }) {
  const { t, tn } = useT();
  const live = nodes.filter((n) => n.state === "live").length;
  const err = nodes.filter((n) => n.state === "error").length;
  return (
    <span className="mono">
      {live}/{nodes.length} {t("nodes.live_suffix")}
      {err > 0 && <span className="text-warn"> · {err} {tn("error", err)}</span>}
    </span>
  );
}

/* ------------------------------ Node card ------------------------------ */

function NodeCard({ node, accent }: { node: DataNode; accent: string }) {
  const { t } = useT();
  const Icon = ICONS[node.kind];
  const color = STATE_COLOR[node.state];
  const live = node.state === "live";
  const err = node.state === "error";

  return (
    <div
      className={cn(
        "surface-line group relative flex h-full flex-col overflow-hidden p-5",
        err && "ring-1 ring-warn/20"
      )}
    >
      {live && (
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full opacity-50 blur-2xl"
          style={{ background: color }}
        />
      )}

      <div className="relative flex items-start gap-3">
        <span
          className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border"
          style={{
            borderColor: `${live ? color : accent}33`,
            background: `${live ? color : accent}12`,
          }}
        >
          <Icon size={18} style={{ color: live ? color : accent }} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-600">{node.label}</div>
          <div className="truncate text-[11px] text-faint">{node.sub}</div>
        </div>
        <StateBadge state={node.state} color={color} />
      </div>

      {/* metric + micro data-flow */}
      <div className="relative mt-4 flex items-end justify-between gap-3">
        <div className="mono text-2xl font-600 leading-none" style={{ color: live ? "#f4f7fa" : "#9aa5b2" }}>
          {node.metric ?? "—"}
        </div>
        {live && <DataFlow color={color} />}
      </div>

      <p className="relative mt-3 text-xs leading-relaxed text-muted">{node.detail}</p>

      {node.fix && (
        <div
          className={cn(
            "relative mt-3 rounded-xl border px-3 py-2.5 text-[11px] leading-relaxed",
            err
              ? "border-warn/20 bg-warn/[0.06] text-warn"
              : "border-line bg-white/[0.02] text-faint"
          )}
        >
          <span className="font-600">{t("nodes.what_to_do")} </span>
          {node.fix}
        </div>
      )}

      {node.lastDate && (
        <div className="relative mt-auto pt-3 text-[10px] text-faint mono">
          {t("nodes.updated")} {node.lastDate}
        </div>
      )}
    </div>
  );
}

function StateBadge({ state, color }: { state: NodeState; color: string }) {
  const { t } = useT();
  const live = state === "live";
  return (
    <span
      className="inline-flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-600"
      style={{
        color,
        borderColor: `${color}33`,
        background: `${color}12`,
      }}
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        {live && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
            style={{ background: color }}
          />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      </span>
      {t(STATE_LABEL[state])}
    </span>
  );
}

/** Анимированный микро-поток данных — бегущие штрихи. */
function DataFlow({ color }: { color: string }) {
  return (
    <svg width="88" height="18" viewBox="0 0 88 18" className="flex-none opacity-90" aria-hidden>
      <line
        x1="2"
        y1="9"
        x2="86"
        y2="9"
        stroke={`${color}33`}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="2"
        y1="9"
        x2="86"
        y2="9"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="3 9"
        style={{ animation: "dash-flow 2.6s linear infinite" }}
      />
    </svg>
  );
}

/* ------------------------------ Skeleton ------------------------------ */

function NodesSkeleton() {
  return (
    <div className="space-y-12">
      {[0, 1].map((g) => (
        <div key={g}>
          <Skeleton className="mb-5 h-10 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-52" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
