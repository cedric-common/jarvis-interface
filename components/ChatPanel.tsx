"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useMemo, useState } from "react";
import { User, Cpu, Mic, Volume2, X } from "lucide-react";
import TypingIndicator from "./TypingIndicator";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatPanelProps {
  messages: Message[];
  isOpen: boolean;
  isListening?: boolean;
  interimTranscript?: string;
  onReplayLastAssistant?: () => void;
  onClose?: () => void;
  isTyping?: boolean;
  onSendMessage?: (text: string) => void;
}

export default function ChatPanel({
  messages,
  isOpen,
  isListening,
  interimTranscript,
  onReplayLastAssistant,
  onClose,
  isTyping,
  onSendMessage,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, interimTranscript, isListening]);

  const lastAssistantMessage = useMemo(() => {
    return [...messages].reverse().find((m) => m.role === "assistant");
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && onSendMessage) {
      onSendMessage(inputText.trim());
      setInputText("");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 50, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 50, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed right-3 sm:right-4 top-16 sm:top-20 bottom-[9.25rem] sm:bottom-4 w-[calc(100vw-1.5rem)] sm:w-[380px] sm:max-w-[calc(100vw-2rem)] z-20"
        >
          <div className="glass-panel-strong rounded-2xl sm:rounded-3xl h-full flex flex-col overflow-hidden border-glow">
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-glow/20 flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-cyan-glow" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Hermes</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">En ligne</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {lastAssistantMessage && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onReplayLastAssistant}
                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-cyan-glow hover:border-cyan-glow/30 transition-colors"
                    title="Rejouer la dernière réponse"
                  >
                    <Volume2 className="w-4 h-4" />
                  </motion.button>
                )}
                {onClose && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/30 transition-colors sm:hidden"
                    title="Fermer"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {messages.length === 0 && !interimTranscript && !isListening && (
                <div className="flex flex-col items-center justify-center h-full text-white/20 space-y-3">
                  <Cpu className="w-10 h-10" />
                  <p className="text-xs font-mono uppercase tracking-wider">Conversation vide</p>
                  <p className="text-[10px] text-white/10 text-center max-w-[200px]">
                    Écrivez ou utilisez le micro pour parler.
                  </p>
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    msg.role === "user" ? "bg-white/10" : "bg-cyan-glow/20"
                  }`}>
                    {msg.role === "user" ? (
                      <User className="w-3.5 h-3.5 text-white/60" />
                    ) : (
                      <Cpu className="w-3.5 h-3.5 text-cyan-glow" />
                    )}
                  </div>
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-white/10 text-white/90 rounded-tr-sm"
                      : "bg-cyan-glow/10 text-cyan-50 rounded-tl-sm border border-cyan-glow/10"
                  }`}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {/* Interim transcript */}
              {interimTranscript && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 flex-row-reverse"
                >
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <div className="max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed bg-white/5 text-white/40 rounded-tr-sm italic">
                    {interimTranscript}
                  </div>
                </motion.div>
              )}

              {/* Typing indicator */}
              {isTyping && <TypingIndicator />}

              {/* Listening indicator */}
              {isListening && !interimTranscript && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-7 h-7 rounded-lg bg-cyan-glow/20 flex items-center justify-center flex-shrink-0">
                    <Mic className="w-3.5 h-3.5 text-cyan-glow animate-pulse" />
                  </div>
                  <div className="px-3 py-2 rounded-2xl text-sm bg-cyan-glow/5 border border-cyan-glow/10 text-cyan-glow/70 rounded-tl-sm">
                    Écoute...
                  </div>
                </motion.div>
              )}
            </div>

            {/* Text Input */}
            <form
              onSubmit={handleSubmit}
              className="px-4 sm:px-5 py-3 border-t border-white/5 flex-shrink-0"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Écrivez un message..."
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/40"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isTyping}
                  className="rounded-xl bg-cyan-500/20 border border-cyan-400/30 px-3 py-2 text-[13px] font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-40 transition-colors"
                >
                  Envoyer
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2 text-white/20">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-glow/50 animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-wider">
                  {isListening ? "Enregistrement en cours..." : "Micro disponible"}
                </span>
              </div>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
