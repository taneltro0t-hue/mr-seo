"use client";

import { useSite } from "@/components/providers";
import { SITES } from "@/lib/sites";

/**
 * Живая сцена под контентом: несколько radial-glow слоёв, которые
 * медленно дышат и дрейфуют, плюс тонкий оттенок под текущий проект.
 * Только transform/opacity → дёшево и 60fps.
 */
export function AmbientScene() {
  const { site } = useSite();
  const accent = SITES[site].accent;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* deep base wash — держим базу у чистого #000, лёгкий тёплый нимб сверху */}
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_85%_at_50%_-12%,rgba(16,18,32,0.55),transparent_60%)]" />

      {/* drifting glow blobs — chroma живёт на чистом чёрном, не под плёнкой */}
      <div
        className="absolute -left-[10%] -top-[15%] h-[70vh] w-[70vh] rounded-full blur-[110px]"
        style={{
          background: `radial-gradient(circle, ${accent}59, transparent 64%)`,
          animation: "drift-a 22s ease-in-out infinite",
        }}
      />
      <div
        className="absolute right-[-8%] top-[6%] h-[60vh] w-[60vh] rounded-full blur-[120px]"
        style={{
          background: "radial-gradient(circle, rgba(56,232,208,0.26), transparent 62%)",
          animation: "drift-b 27s ease-in-out infinite",
        }}
      />
      <div
        className="absolute bottom-[-20%] left-[30%] h-[70vh] w-[70vh] rounded-full blur-[130px]"
        style={{
          background: "radial-gradient(circle, rgba(106,99,245,0.28), transparent 64%)",
          animation: "drift-c 31s ease-in-out infinite",
        }}
      />

      {/* slow conic sheen */}
      <div
        className="absolute left-1/2 top-1/2 h-[140vh] w-[140vh] -translate-x-1/2 -translate-y-1/2 opacity-[0.06] blur-[60px]"
        style={{
          background: "conic-gradient(from 0deg, transparent, rgba(139,147,255,0.6), transparent 40%, rgba(56,232,208,0.5), transparent)",
          animation: "orb-spin 90s linear infinite",
        }}
      />
    </div>
  );
}
