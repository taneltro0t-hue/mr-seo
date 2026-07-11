"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { perfTier, prefersReducedMotion, subscribe } from "@/components/orb-ticker";

/** Режимы орба. Совместим с OrbState чата (idle/thinking/speaking) + alert. */
export type OrbMode = "idle" | "thinking" | "speaking" | "alert";
export type OrbTint = "neutral" | "good" | "ok" | "warn";

interface Props {
  size?: number;
  state?: OrbMode;
  tint?: OrbTint;
  interactive?: boolean;
  /** Единственный на экран орб с дышащим внешним свечением (5.5s). */
  hero?: boolean;
  className?: string;
}

/* ---------- Палитры: экватор → полюс + свечение (бренд: фиолет + циан) ---------- */

interface Palette {
  core: string; // яркое ядро частицы
  equator: [number, number, number];
  pole: [number, number, number];
  glow: string; // css-цвет внешнего свечения
}

const TINTS: Record<OrbTint, Palette> = {
  neutral: { core: "#eef0ff", equator: [139, 147, 255], pole: [56, 232, 208], glow: "rgba(139,147,255,0.5)" },
  good: { core: "#e7fff4", equator: [75, 211, 154], pole: [56, 232, 208], glow: "rgba(75,211,154,0.5)" },
  ok: { core: "#fff2d6", equator: [244, 194, 90], pole: [139, 147, 255], glow: "rgba(244,194,90,0.48)" },
  warn: { core: "#ffe0e0", equator: [255, 107, 107], pole: [139, 147, 255], glow: "rgba(255,107,107,0.5)" },
};

/* ---------- Целевые параметры состояний ----------
   Атака (вход) быстрее релиза (выхода) — ключ к «живости». */
interface Target {
  bright: number;
  noise: number;
  speed: number;
  voice: number;
}
const TARGETS: Record<OrbMode, Target> = {
  idle: { bright: 1.0, noise: 1.0, speed: 1.0, voice: 0.0 },
  thinking: { bright: 1.8, noise: 1.9, speed: 2.3, voice: 0.16 }, // вспышка +1.8×
  speaking: { bright: 1.28, noise: 1.35, speed: 1.5, voice: 0.85 },
  alert: { bright: 1.42, noise: 1.7, speed: 1.7, voice: 0.28 },
};

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const N_SPRITES = 6;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function mixToWhite([r, g, b]: [number, number, number], k: number): [number, number, number] {
  return [lerp(r, 255, k), lerp(g, 255, k), lerp(b, 255, k)];
}

/** Асимметричный envelope: цель выше — быстрая атака, цель ниже — медленный релиз. */
function approach(cur: number, target: number, attack: number, release: number, dt: number) {
  const rate = target > cur ? attack : release;
  const k = 1 - Math.exp(-rate * dt);
  return cur + (target - cur) * k;
}

/* Кэш спрайтов частиц по тинту (строятся один раз): 3 слоя свечения (glow·halo·core). */
const spriteCache = new Map<OrbTint, HTMLCanvasElement[]>();

function buildSprites(tint: OrbTint): HTMLCanvasElement[] {
  const cached = spriteCache.get(tint);
  if (cached) return cached;
  const p = TINTS[tint];
  const S = 48;
  const sprites: HTMLCanvasElement[] = [];
  for (let k = 0; k < N_SPRITES; k++) {
    const t = k / (N_SPRITES - 1);
    const col: [number, number, number] = [
      lerp(p.equator[0], p.pole[0], t),
      lerp(p.equator[1], p.pole[1], t),
      lerp(p.equator[2], p.pole[2], t),
    ];
    const [cr, cg, cb] = mixToWhite(col, 0.75); // ядро тянем к белому
    const cv = document.createElement("canvas");
    cv.width = cv.height = S;
    const g = cv.getContext("2d")!;
    const cx = S / 2;

    // слой 1 — рассеянный glow
    let grad = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grad.addColorStop(0, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},0.34)`);
    grad.addColorStop(0.45, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},0.10)`);
    grad.addColorStop(1, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);

    // слой 2 — halo
    grad = g.createRadialGradient(cx, cx, 0, cx, cx, cx * 0.5);
    grad.addColorStop(0, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},0.7)`);
    grad.addColorStop(1, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);

    // слой 3 — яркое ядро
    grad = g.createRadialGradient(cx, cx, 0, cx, cx, cx * 0.22);
    grad.addColorStop(0, `rgba(${cr | 0},${cg | 0},${cb | 0},1)`);
    grad.addColorStop(1, `rgba(${cr | 0},${cg | 0},${cb | 0},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);

    sprites.push(cv);
  }
  spriteCache.set(tint, sprites);
  return sprites;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  band: number; // индекс спрайта по |y|
}

function buildParticles(n: number): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2; // 1 → −1
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * GOLDEN;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const band = Math.min(N_SPRITES - 1, Math.floor(Math.abs(y) * N_SPRITES));
    out.push({ x, y, z, band });
  }
  return out;
}

function particleCount(size: number): number {
  const base = size >= 150 ? 900 : size >= 96 ? 620 : size >= 64 ? 420 : 300;
  const tier = perfTier();
  const factor = tier === "high" ? 1 : tier === "mid" ? 0.7 : 0.45;
  return Math.round(base * factor);
}

/**
 * Mr.Seo — живое существо на Canvas 2D. Сфера Фибоначчи из частиц с
 * 3-слойным свечением и глубинной альфой, дыхание двумя перемножёнными
 * синусами, 4 состояния с асимметричным easing (атака быстрее релиза),
 * thinking-вспышка +1.8×. Деградация: reduced-motion / слабое железо → меньше
 * частиц или статичный градиент.
 */
export function SeoOrb({
  size = 120,
  state = "idle",
  tint = "neutral",
  interactive = false,
  hero = false,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OrbMode>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const p = TINTS[tint];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    const tier = perfTier();
    const dpr = Math.min(reduced ? 1 : tier === "high" ? 2 : tier === "mid" ? 1.5 : 1, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    const sprites = buildSprites(tint);
    const particles = buildParticles(reduced ? Math.min(260, particleCount(size)) : particleCount(size));

    const cx = (size * dpr) / 2;
    const cy = (size * dpr) / 2;
    const R = size * dpr * 0.34;
    const baseP = size * dpr * 0.075; // базовый размер спрайта частицы

    // смягчаемые параметры состояния
    const cur = { bright: 1, noise: 1, speed: 1, voice: 0 };
    let rot = 0;
    let tiltPhase = 0;

    function draw(t: number, dt: number) {
      const target = TARGETS[stateRef.current];
      cur.bright = approach(cur.bright, target.bright, 16, 4, dt); // вспышка: вход ~4× быстрее выхода
      cur.noise = approach(cur.noise, target.noise, 10, 4, dt);
      cur.speed = approach(cur.speed, target.speed, 8, 4, dt);
      cur.voice = approach(cur.voice, target.voice, 22, 5, dt); // атака 0.85 / релиз 0.18

      // псевдо-аудио огибающая для speaking/alert
      const env = cur.voice * (0.62 + 0.38 * Math.abs(Math.sin(t * 7) + 0.5 * Math.sin(t * 13.3)));
      const inflate = 1 + env * 0.15; // сфера раздувается до +15%

      rot += dt * 0.2 * cur.speed;
      tiltPhase += dt * 0.4;
      const tilt = 0.42 + Math.sin(tiltPhase) * 0.05;
      const cosR = Math.cos(rot), sinR = Math.sin(rot);
      const cosT = Math.cos(tilt), sinT = Math.sin(tilt);

      const globalBreath = Math.sin(t * 0.9) * Math.sin(t * 0.6) * 0.02;
      const noiseAmp = 0.11 * cur.noise;

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.globalCompositeOperation = "lighter";

      // мягкое тело-свечение для объёма
      const body = ctx!.createRadialGradient(cx, cy, 0, cx, cy, R * 1.35 * inflate);
      body.addColorStop(0, `rgba(${p.equator[0]},${p.equator[1]},${p.equator[2]},${0.1 * cur.bright})`);
      body.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = body;
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);

      for (const pt of particles) {
        // поверхностное дыхание: два перемноженных синуса по позиции + время
        const disp = Math.sin(pt.x * 3 + t * 0.8) * Math.sin(pt.y * 2 + t * 0.6) * noiseAmp;
        const rr = R * (1 + disp + globalBreath) * inflate;

        // вращение вокруг Y
        const x = pt.x * cosR + pt.z * sinR;
        let z = -pt.x * sinR + pt.z * cosR;
        let y = pt.y;
        // наклон вокруг X
        const y2 = y * cosT - z * sinT;
        const z2 = y * sinT + z * cosT;
        y = y2;
        z = z2;

        const sx = cx + x * rr;
        const sy = cy + y * rr;
        const depth = z * 0.5 + 0.5; // 0 (зад) → 1 (перёд)
        const alpha = (0.18 + depth * 0.67) * cur.bright;
        const psize = baseP * (0.55 + depth * 0.65) * (1 + env * 0.2);

        ctx!.globalAlpha = Math.min(1, alpha);
        const spr = sprites[pt.band];
        ctx!.drawImage(spr, sx - psize / 2, sy - psize / 2, psize, psize);
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = "source-over";
    }

    if (reduced) {
      draw(0, 0.016);
      return;
    }
    const unsub = subscribe(draw);
    return unsub;
    // размер/тинт меняются редко; пересобираем эффект при их смене
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, tint]);

  return (
    <motion.div
      className={className}
      style={{ width: size, height: size, position: "relative", flex: "0 0 auto" }}
      whileHover={interactive ? { scale: 1.07 } : undefined}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      aria-hidden
    >
      {/* внешнее свечение: дышит только у hero-орба (одно на экран) */}
      <div
        style={{
          position: "absolute",
          inset: -size * 0.42,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${p.glow}, transparent 66%)`,
          filter: `blur(${size * 0.12}px)`,
          opacity: hero ? 0.9 : 0.55,
          ["--gb" as string]: p.glow,
        }}
        className={hero ? "breathe-glow" : undefined}
      />
      {/* мгновенный CSS-фолбэк под canvas (виден до первого кадра и при reduced-motion) */}
      <div
        style={{
          position: "absolute",
          inset: size * 0.14,
          borderRadius: "50%",
          background: `radial-gradient(120% 120% at 34% 28%, ${p.core} 0%, rgba(${p.equator[0]},${p.equator[1]},${p.equator[2]},0.9) 38%, rgba(${p.pole[0]},${p.pole[1]},${p.pole[2]},0.4) 72%, transparent 100%)`,
          opacity: 0.28,
        }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: size, height: size, display: "block" }}
      />
    </motion.div>
  );
}
