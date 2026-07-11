"use client";

import { motion } from "framer-motion";

/**
 * Cohesive scene transition — every route mount eases in with a faint
 * scale + blur lift, so navigating feels like the camera settling on a new
 * console rather than a page swap.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985, filter: "blur(8px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
