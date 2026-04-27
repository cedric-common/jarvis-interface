"use client";

import { motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";

interface VoiceOrbProps {
  isListening: boolean;
  onToggle: () => void;
}

export default function VoiceOrb({ isListening, onToggle }: VoiceOrbProps) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow rings */}
      {isListening && (
        <>
          <motion.div
            className="absolute rounded-full border border-cyan-glow/20"
            initial={{ width: 120, height: 120, opacity: 0 }}
            animate={{
              width: [120, 200, 120],
              height: [120, 200, 120],
              opacity: [0.3, 0, 0.3],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute rounded-full border border-blue-glow/15"
            initial={{ width: 120, height: 120, opacity: 0 }}
            animate={{
              width: [120, 260, 120],
              height: [120, 260, 120],
              opacity: [0.2, 0, 0.2],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          />
        </>
      )}

      {/* Main orb */}
      <motion.button
        onClick={onToggle}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
          isListening
            ? "bg-cyan-glow/20 border-2 border-cyan-glow/50 animate-pulse-glow"
            : "bg-white/5 border-2 border-white/10 hover:border-cyan-glow/30 hover:bg-cyan-glow/10"
        }`}
      >
        {/* Inner rotating ring */}
        <motion.div
          className="absolute inset-2 rounded-full border border-dashed border-cyan-glow/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />

        {/* Icon */}
        <motion.div
          animate={isListening ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {isListening ? (
            <Mic className="w-8 h-8 text-cyan-glow" />
          ) : (
            <MicOff className="w-8 h-8 text-white/40" />
          )}
        </motion.div>
      </motion.button>

      {/* Status text */}
      <motion.div
        className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap"
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <span className={`text-xs font-mono uppercase tracking-[0.2em] ${isListening ? "text-cyan-glow text-glow" : "text-white/30"}`}>
          {isListening ? "Écoute en cours..." : "Appuyez pour parler"}
        </span>
      </motion.div>
    </div>
  );
}
