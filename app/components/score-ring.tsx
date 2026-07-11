"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { KineticNumber } from "@/components/kinetic-number";
import type { Tone } from "@/lib/types";

const TONE: Record<Tone, { from: string; to: string; glow: string }> = {
  good: { from: "#38e8d0", to: "#8b93ff", glow: "rgba(56,232,208,0.4)" },
  ok: { from: "#f4c25a", to: "#8b93ff", glow: "rgba(244,194,90,0.35)" },
  warn: { from: "#ff6b6b", to: "#f4c25a", glow: "rgba(255,107,107,0.4)" },
};

interface Props {
  value: number; // 0..100
  tone: Tone;
  verdict: string;
  size?: number;
}

export function ScoreRing({ value, tone, verdict, size = 260 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const t = TONE[tone];
  const gid = `score-grad-${tone}`;

  return (
    <div ref={ref} style={{ width: size, height: size }} className="relative">
      <div
        className="breathe-glow absolute inset-0 rounded-full"
        style={{ ["--gb" as string]: t.glow }}
      />
      <svg width={size} height={size} className="rotate-[-90deg]">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={t.from} />
            <stop offset="100%" stopColor={t.to} />
          </linearGradient>
        </defs>
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        {/* progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: inView ? c - c * pct : c }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <KineticNumber
          value={value}
          duration={1.8}
          className="tabular font-display text-[6.5rem] font-600 leading-[0.82] tracking-[-0.05em] text-ink"
        />
        <div className="mt-2 text-[11px] uppercase tracking-[0.3em] text-faint">Здоровье</div>
        <div
          className="mt-3 rounded-full px-3.5 py-1 text-sm font-600"
          style={{
            color: t.from,
            background: `${t.glow}`,
            border: `1px solid ${t.from}55`,
          }}
        >
          {verdict}
        </div>
      </div>
    </div>
  );
}
