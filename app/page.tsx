"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Volume2, VolumeX } from "lucide-react";
import HUDCanvas from "@/components/HUDCanvas";
import Waveform from "@/components/Waveform";
import VoiceOrb from "@/components/VoiceOrb";
import ChatPanel, { Message } from "@/components/ChatPanel";
import QuickActions from "@/components/QuickActions";
import useSpeechRecognition from "@/hooks/useSpeechRecognition";
import useSpeechSynthesis from "@/hooks/useSpeechSynthesis";

export default function Home() {
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [waveformActive, setWaveformActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  const { speak, stop: stopSpeaking } = useSpeechSynthesis();
  const lastSpokenIdRef = useRef<string | null>(null);
  const streamingTextRef = useRef<string>("");

  const addMessage = useCallback((role: "user" | "assistant", content: string) => {
    const id = Date.now().toString() + Math.random();
    setMessages((prev) => [...prev, { id, role, content, timestamp: new Date() }]);
    return id;
  }, []);

  const updateLastAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => {
      const last = [...prev].reverse().find((m) => m.role === "assistant");
      if (!last) return prev;
      return prev.map((m) => (m.id === last.id ? { ...m, content } : m));
    });
  }, []);

  const sendMessageToHermes = useCallback(async (text: string) => {
    setIsTyping(true);
    setWaveformActive(true);
    streamingTextRef.current = "";

    // Build history (last 10 messages)
    const history = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/hermes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      // Create empty assistant message
      const assistantId = addMessage("assistant", "");

      // Read stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                streamingTextRef.current += parsed.text;
                updateLastAssistantMessage(streamingTextRef.current);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      // Fallback to old API
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        const data = await res.json();
        if (data.response) {
          addMessage("assistant", data.response);
        }
      } catch {
        addMessage("assistant", "Désolé, une erreur de connexion est survenue. Veuillez réessayer.");
      }
    } finally {
      setIsTyping(false);
      setWaveformActive(false);
    }
  }, [messages, addMessage, updateLastAssistantMessage]);

  // Send transcript when listening stops
  useEffect(() => {
    if (!isListening && transcript.trim()) {
      const text = transcript.trim();
      addMessage("user", text);
      resetTranscript();
      sendMessageToHermes(text);
    }
  }, [isListening, transcript, addMessage, resetTranscript, sendMessageToHermes]);

  // Disable waveform if stopped with no transcript
  useEffect(() => {
    if (!isListening && !transcript.trim()) {
      setWaveformActive(false);
    }
  }, [isListening, transcript]);

  // Auto-speak assistant responses
  useEffect(() => {
    if (muted) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "assistant" && lastMsg.id !== lastSpokenIdRef.current) {
      // Only speak when the message is complete (not streaming)
      if (!isTyping && lastMsg.content.length > 0) {
        lastSpokenIdRef.current = lastMsg.id;
        speak(lastMsg.content);
      }
    }
  }, [messages, muted, isTyping, speak]);

  const handleToggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
      setChatOpen(true);
      setWaveformActive(true);
    }
  }, [isListening, startListening, stopListening]);

  const handleQuickAction = useCallback(
    (command: string) => {
      setChatOpen(true);
      addMessage("user", command);
      sendMessageToHermes(command);
    },
    [addMessage, sendMessageToHermes]
  );

  const handleReplayLastAssistant = useCallback(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAssistant) {
      speak(lastAssistant.content);
    }
  }, [messages, speak]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      if (!prev) stopSpeaking();
      return !prev;
    });
  }, [stopSpeaking]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Background HUD */}
      <HUDCanvas />

      {/* Top bar */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 pt-[env(safe-area-inset-top)] pb-2 sm:py-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-glow/20 flex items-center justify-center border border-cyan-glow/30">
            <span className="text-xs font-bold text-cyan-glow font-mono">H</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-tight">JARVIS</h1>
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Hermes Interface</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleMute}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              muted
                ? "bg-white/5 border border-white/10 text-white/40 hover:text-white/70"
                : "bg-cyan-glow/20 border border-cyan-glow/40 text-cyan-glow"
            }`}
            title={muted ? "Activer la voix" : "Couper la voix"}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setChatOpen(!chatOpen)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              chatOpen
                ? "bg-cyan-glow/20 border border-cyan-glow/40 text-cyan-glow"
                : "bg-white/5 border border-white/10 text-white/40 hover:text-white/70"
            }`}
          >
            {chatOpen ? <X className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
          </motion.button>
        </div>
      </motion.header>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pb-24 sm:pb-0">
        {/* Waveform */}
        <AnimatePresence>
          {waveformActive && (
            <motion.div
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0 }}
              className="w-64 h-16 mb-8"
            >
              <Waveform isActive={waveformActive} intensity={isListening ? 1.5 : 0.8} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice Orb */}
        <VoiceOrb isListening={isListening} onToggle={handleToggleListening} />

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-16 text-xs font-mono text-white/20 text-center max-w-md px-4"
        >
          Interface de contrôle vocale — Prototype v0.3
        </motion.p>
      </div>

      {/* Chat Panel */}
      <ChatPanel
        messages={messages}
        isOpen={chatOpen}
        isListening={isListening}
        interimTranscript={interimTranscript}
        onReplayLastAssistant={handleReplayLastAssistant}
        onClose={() => setChatOpen(false)}
        isTyping={isTyping}
      />

      {/* Quick Actions */}
      <QuickActions onAction={handleQuickAction} />
    </main>
  );
}
