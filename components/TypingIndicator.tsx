"use client";

import { motion } from "framer-motion";

export default function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      className="flex gap-3"
    >
      <div className="w-7 h-7 rounded-lg bg-cyan-glow/20 flex items-center justify-center flex-shrink-0">
        <div className="w-3.5 h-3.5 rounded-full bg-cyan-glow/40 animate-pulse" />
      </div>
      <div className="px-3 py-2 rounded-2xl bg-cyan-glow/5 border border-cyan-glow/10 rounded-tl-sm flex items-center gap-1.5">
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-cyan-glow/60"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
        />
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-cyan-glow/60"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
        />
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-cyan-glow/60"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
        />
        <span className="text-[10px] font-mono text-cyan-glow/50 ml-1">Hermes réfléchit...</span>
      </div>
    </motion.div>
  );
}
