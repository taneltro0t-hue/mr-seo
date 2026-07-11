"use client";

import { animate } from "framer-motion";
import { useEffect, useState } from "react";

interface Props {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * Kinetic count-up число. Анимируется на маунте до значения.
 * Не завязано на IntersectionObserver, чтобы числа ниже сгиба
 * никогда не «залипали» на нуле.
 */
export function KineticNumber({
  value,
  decimals = 0,
  duration = 1.4,
  className,
  prefix = "",
  suffix = "",
}: Props) {
  const [display, setDisplay] = useState(() => value.toFixed(decimals));

  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v.toFixed(decimals)),
    });
    return () => controls.stop();
  }, [value, decimals, duration]);

  return (
    <span className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
