"use client";

import { useEffect, useRef } from "react";
import { perfTier, prefersReducedMotion, subscribe } from "@/components/orb-ticker";

interface Props {
  className?: string;
  /** Основной цвет комет (по теме проекта). */
  color?: string;
  /** Плотность сетки в px. */
  step?: number;
}

interface Comet {
  horizontal: boolean;
  pos: number; // фиксированная линия (px в css-координатах)
  t: number; // прогресс 0..1
  speed: number;
  len: number;
}

/**
 * Тонкая ретро-сетка + бегущие световые кометы по её линиям (функциональный
 * аналог декоративного грид-пола Zoey). Только для hero-зон. Canvas, единый
 * тикер, деградация по reduced-motion / железу.
 */
export function GridComets({ className, color = "139,147,255", step = 46 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const reduced = prefersReducedMotion();
    const tier = perfTier();
    const dpr = Math.min(tier === "low" ? 1 : 1.5, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);

    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;

    function resize() {
      const r = parent!.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      cols = Math.ceil(w / step) + 1;
      rows = Math.ceil(h / step) + 1;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    const maxComets = reduced ? 0 : tier === "low" ? 5 : tier === "mid" ? 9 : 14;
    const comets: Comet[] = [];

    function spawn(): Comet {
      const horizontal = Math.random() < 0.5;
      const pos = horizontal
        ? Math.round(Math.random() * rows) * step
        : Math.round(Math.random() * cols) * step;
      return {
        horizontal,
        pos,
        t: 0,
        speed: 0.08 + Math.random() * 0.16,
        len: 60 + Math.random() * 120,
      };
    }

    function drawGrid() {
      ctx!.strokeStyle = `rgba(${color},0.05)`;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      for (let i = 0; i <= cols; i++) {
        const x = Math.round(i * step) * dpr + 0.5;
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x, h * dpr);
      }
      for (let j = 0; j <= rows; j++) {
        const y = Math.round(j * step) * dpr + 0.5;
        ctx!.moveTo(0, y);
        ctx!.lineTo(w * dpr, y);
      }
      ctx!.stroke();
    }

    function frame(_t: number, dt: number) {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      drawGrid();

      if (maxComets > 0 && comets.length < maxComets && Math.random() < dt * 1.4) {
        comets.push(spawn());
      }

      ctx!.globalCompositeOperation = "lighter";
      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i];
        c.t += dt * c.speed;
        if (c.t >= 1) {
          comets.splice(i, 1);
          continue;
        }
        const travel = (c.horizontal ? w : h) * c.t;
        const fade =
          c.t < 0.08 ? c.t / 0.08 : c.t > 0.85 ? (1 - c.t) / 0.15 : 1;

        const hx = c.horizontal ? travel : c.pos;
        const hy = c.horizontal ? c.pos : travel;
        const tx = c.horizontal ? travel - c.len : c.pos;
        const ty = c.horizontal ? c.pos : travel - c.len;

        const grad = ctx!.createLinearGradient(tx * dpr, ty * dpr, hx * dpr, hy * dpr);
        grad.addColorStop(0, `rgba(${color},0)`);
        grad.addColorStop(1, `rgba(${color},${0.55 * fade})`);
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.6 * dpr;
        ctx!.beginPath();
        ctx!.moveTo(tx * dpr, ty * dpr);
        ctx!.lineTo(hx * dpr, hy * dpr);
        ctx!.stroke();

        // голова — радиальное свечение
        const head = ctx!.createRadialGradient(hx * dpr, hy * dpr, 0, hx * dpr, hy * dpr, 6 * dpr);
        head.addColorStop(0, `rgba(${color},${0.85 * fade})`);
        head.addColorStop(1, `rgba(${color},0)`);
        ctx!.fillStyle = head;
        ctx!.fillRect((hx - 6) * dpr, (hy - 6) * dpr, 12 * dpr, 12 * dpr);
      }
      ctx!.globalCompositeOperation = "source-over";
    }

    if (reduced) {
      // статичная сетка без комет
      requestAnimationFrame(() => {
        ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
        drawGrid();
      });
      return () => ro.disconnect();
    }

    const unsub = subscribe(frame);
    return () => {
      unsub();
      ro.disconnect();
    };
  }, [color, step]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      aria-hidden
    />
  );
}
