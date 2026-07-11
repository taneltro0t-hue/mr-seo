"use client";

import { motion, useInView } from "framer-motion";
import { useId, useMemo, useRef } from "react";

interface Props {
  values: (number | null)[];
  /** Меньше = лучше (позиции). Тогда ось Y инвертируется. */
  invert?: boolean;
  color?: string;
  height?: number;
  className?: string;
}

const VW = 120;

export function Sparkline({
  values,
  invert = false,
  color = "#8b93ff",
  height = 44,
  className,
}: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const gid = useId().replace(/:/g, "");

  const { line, area, last } = useMemo(() => {
    const n = values.length;
    const nums = values.filter((v): v is number => v != null);
    if (nums.length === 0 || n < 2) return { line: "", area: "", last: null };
    let min = Math.min(...nums);
    let max = Math.max(...nums);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const pad = 6;
    const H = height;
    const mapX = (i: number) => (i / (n - 1)) * VW;
    const mapY = (v: number) => {
      const t = (v - min) / (max - min); // 0..1
      const tt = invert ? t : 1 - t; // invert: меньше значение -> выше
      return pad + tt * (H - pad * 2);
    };
    const pts: { x: number; y: number }[] = [];
    values.forEach((v, i) => {
      if (v != null) pts.push({ x: mapX(i), y: mapY(v) });
    });
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;
    return { line, area, last: pts[pts.length - 1] };
  }, [values, invert, height]);

  if (!line) {
    return (
      <div
        className={className}
        style={{ height }}
        aria-hidden
      >
        <div className="flex h-full items-center text-[11px] text-faint">нет в окне</div>
      </div>
    );
  }

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${VW} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: "100%", height, display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`sfill-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sfill-${gid})`} />
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={inView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />
      {last && (
        <motion.circle
          cx={last.x}
          cy={last.y}
          r={2.6}
          fill={color}
          vectorEffect="non-scaling-stroke"
          initial={{ scale: 0 }}
          animate={inView ? { scale: 1 } : {}}
          transition={{ delay: 0.9, type: "spring", stiffness: 300 }}
        />
      )}
    </svg>
  );
}
