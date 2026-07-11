"use client";

import { useEffect, useRef, useState } from "react";
import { useSite } from "@/components/providers";
import { useApi } from "@/components/use-api";
import { perfTier, prefersReducedMotion, subscribe } from "@/components/orb-ticker";
import { SITES } from "@/lib/sites";
import type { AgentsResponse, Overview, RunsResponse } from "@/lib/types";

/** Mini oscilloscope — a live waveform whose energy tracks swarm activity. */
function Scope({ energy, color }: { energy: number; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const energyRef = useRef(energy);
  useEffect(() => {
    energyRef.current = energy;
  }, [energy]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(perfTier() === "low" ? 1 : 1.5, window.devicePixelRatio || 1);
    const W = 72;
    const H = 22;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const reduced = prefersReducedMotion();

    function paint(t: number) {
      ctx!.clearRect(0, 0, W, H);
      const mid = H / 2;
      const amp = (0.18 + energyRef.current * 0.62) * (H / 2 - 2);
      ctx!.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const p = x / W;
        const wob = reduced
          ? Math.sin(p * Math.PI * 3) * 0.4
          : Math.sin(p * Math.PI * 6 - t * 3) * Math.sin(p * Math.PI * 2 + t * 1.3);
        const y = mid + wob * amp;
        if (x === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);
      }
      ctx!.strokeStyle = color;
      ctx!.lineWidth = 1.25;
      ctx!.globalAlpha = 0.9;
      ctx!.stroke();
    }

    if (reduced) {
      paint(0);
      return;
    }
    return subscribe((t) => paint(t));
  }, [color]);

  return <canvas ref={ref} style={{ width: 72, height: 22, display: "block" }} aria-hidden />;
}

function Clock() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="mono tabular text-[11px] text-muted">{now ?? "--:--:--"}</span>;
}

/**
 * Bottom live data line — the pulse of the organism. Real events scroll past:
 * last scan, freshest run signal, reputation, task load. A live oscilloscope
 * and clock frame it. Fixed, offset by the rail.
 */
export function LiveTicker() {
  const { site } = useSite();
  const { data: overview } = useApi<Overview>(`/api/overview?site=${site}`);
  const { data: agentsData } = useApi<AgentsResponse>("/api/agents");
  const { data: runsData } = useApi<RunsResponse>("/api/runs");

  const agents = agentsData?.agents ?? [];
  const working = agents.filter((a) => a.status === "live").length;
  const anyError = agents.some((a) => a.status === "error");
  const energy = agents.length ? working / agents.length : 0;
  const accent = SITES[site].accent;
  const royColor = anyError ? "#ff6b6b" : working > 0 ? "#4bd39a" : "#9aa5b2";

  const events: string[] = [];
  if (overview) {
    events.push(`СКАН · ${overview.date}`);
    events.push(`ЗДОРОВЬЕ ${overview.site.label} · ${overview.score.value}/100 · ${overview.score.verdict}`);
    const live = overview.sources.filter((s) => s.status === "live");
    const clicks = live.reduce((a, s) => a + s.clicks7d, 0);
    events.push(`ПЕРЕХОДЫ 7Д · ${clicks}`);
    const bestRep = [...overview.reputation].sort((a, b) => b.rating - a.rating)[0];
    if (bestRep) events.push(`РЕПУТАЦИЯ · ${bestRep.rating.toFixed(1)}★ ${bestRep.label}`);
  }
  const topRun = runsData?.runs?.[0];
  if (topRun?.signals?.[0]) events.push(`СВОДКА · ${topRun.signals[0].text}`);
  events.push("MR.SEO OS · v1.4");
  const line = events.join("      ·      ");

  return (
    <div className="marquee-mask fixed bottom-0 left-0 right-0 z-40 flex h-9 items-center gap-3 border-t border-line bg-base-2/85 px-3 backdrop-blur-2xl lg:left-[72px]">
      {/* roy status */}
      <div className="flex flex-none items-center gap-2 pl-1">
        <span className="warm-pulse h-1.5 w-1.5 rounded-full" style={{ background: royColor }} />
        <span className="mono hidden text-[11px] text-muted sm:inline">
          РОЙ {working}/{agents.length || "—"}
        </span>
      </div>
      <div className="rule-y hidden h-4 sm:block" />

      {/* oscilloscope */}
      <div className="flex-none">
        <Scope energy={energy} color={accent} />
      </div>
      <div className="rule-y h-4" />

      {/* scrolling events */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="marquee-track">
          <span className="mono pr-8 text-[11px] tracking-[0.06em] text-faint">{line}</span>
          <span className="mono pr-8 text-[11px] tracking-[0.06em] text-faint" aria-hidden>
            {line}
          </span>
        </div>
      </div>

      <div className="rule-y hidden h-4 sm:block" />
      <div className="hidden flex-none items-center gap-3 pr-1 sm:flex">
        <Clock />
      </div>
    </div>
  );
}
