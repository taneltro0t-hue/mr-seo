// Единый rAF-тикер для всех орбов: вместо N отдельных requestAnimationFrame —
// один цикл, который раздаёт (t, dt) подписчикам. Пауза при скрытой вкладке.

type TickFn = (t: number, dt: number) => void;

const subs = new Set<TickFn>();
let raf = 0;
let last = 0;
let running = false;

function loop(now: number) {
  const t = now / 1000;
  const dt = last ? Math.min(0.05, t - last) : 0.016;
  last = t;
  // копия набора — подписчик может отписаться внутри тика
  for (const fn of Array.from(subs)) fn(t, dt);
  raf = requestAnimationFrame(loop);
}

function start() {
  if (running) return;
  running = true;
  last = 0;
  raf = requestAnimationFrame(loop);
}

function stop() {
  if (!running) return;
  running = false;
  cancelAnimationFrame(raf);
}

export function subscribe(fn: TickFn): () => void {
  subs.add(fn);
  if (subs.size === 1 && (typeof document === "undefined" || !document.hidden)) start();
  return () => {
    subs.delete(fn);
    if (subs.size === 0) stop();
  };
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (subs.size > 0) start();
  });
}

/** Класс железа для деградации тиров частиц. */
export function perfTier(): "low" | "mid" | "high" {
  if (typeof navigator === "undefined") return "high";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  if (mem <= 4 || cores <= 4) return "low";
  if (mem <= 6 || cores <= 6) return "mid";
  return "high";
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
