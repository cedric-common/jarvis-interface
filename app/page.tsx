"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Volume2, VolumeX, Ear, EarOff } from "lucide-react";
import HUDCanvas from "@/components/HUDCanvas";
import Waveform from "@/components/Waveform";
import VoiceOrb from "@/components/VoiceOrb";
import ChatPanel, { Message } from "@/components/ChatPanel";
import QuickActions from "@/components/QuickActions";
import VPSMetrics from "@/components/VPSMetrics";
import useSpeechRecognition from "@/hooks/useSpeechRecognition";
import useSpeechSynthesis from "@/hooks/useSpeechSynthesis";

export default function Home() {
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [waveformActive, setWaveformActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationMode, setConversationMode] = useState(false);
  const [isSpeakingTTS, setIsSpeakingTTS] = useState(false);

  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    continuous: conversationMode,
    autoRestart: conversationMode && !isSpeakingTTS,
  });

  const { speak, stop: stopSpeaking, isSpeaking } = useSpeechSynthesis();
  const lastSpokenIdRef = useRef<string | null>(null);
  const streamingTextRef = useRef<string>("");
  const conversationModeRef = useRef(conversationMode);

  useEffect(() => {
    conversationModeRef.current = conversationMode;
  }, [conversationMode]);

  useEffect(() => {
    setIsSpeakingTTS(isSpeaking);
  }, [isSpeaking]);

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

  // Conversation mode: restart listening after TTS finishes
  useEffect(() => {
    if (conversationMode && !isSpeaking && !isTyping && !isListening) {
      const timer = setTimeout(() => {
        startListening();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [conversationMode, isSpeaking, isTyping, isListening, startListening]);

  const handleToggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
      setChatOpen(true);
      setWaveformActive(true);
    }
  }, [isListening, startListening, stopListening]);

  const toggleConversationMode = useCallback(() => {
    setConversationMode((prev) => {
      const next = !prev;
      if (!next) {
        stopListening();
      } else {
        setChatOpen(true);
        startListening();
      }
      return next;
    });
  }, [startListening, stopListening]);

  const handleQuickAction = useCallback(
    async (command: string) => {
      setChatOpen(true);

      // Special handling for Notion tasks
      if (command === "Mes tâches du jour") {
        addMessage("user", command);
        setIsTyping(true);
        try {
          const res = await fetch("/api/notion-tasks");
          const data = await res.json();

          if (data.error) {
            addMessage("assistant", `❌ Erreur Notion : ${data.error}`);
          } else if (data.tasks && data.tasks.length > 0) {
            const today = new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            });
            let response = `📋 **Tâches du ${today}**\n\n`;

            // Group by client
            const byClient: Record<string, typeof data.tasks> = {};
            for (const task of data.tasks) {
              const c = task.client || "Général";
              if (!byClient[c]) byClient[c] = [];
              byClient[c].push(task);
            }

            for (const [client, tasks] of Object.entries(byClient)) {
              response += `🏢 **${client}**\n`;
              for (const task of tasks) {
                const statusEmoji = task.status
                  ? task.status.toLowerCase().includes("en cours")
                    ? "🔵"
                    : task.status.toLowerCase().includes("urgent")
                    ? "🔴"
                    : "⏳"
                  : "⏳";
                response += `  ${statusEmoji} ${task.title}${
                  task.status ? ` (*${task.status}*)` : ""
                }\n`;
              }
              response += "\n";
            }

            const id = addMessage("assistant", response.trim());
            if (!muted) {
              lastSpokenIdRef.current = id;
              speak(
                `Tu as ${data.tasks.length} tâche${
                  data.tasks.length > 1 ? "s" : ""
                } aujourd'hui. Consulte l'écran pour les détails.`
              );
            }
          } else {
            const id = addMessage(
              "assistant",
              "✨ **Pas de tâche prévue aujourd'hui !**\n\nProfite de cette journée pour avancer sereinement. 💪"
            );
            if (!muted) {
              lastSpokenIdRef.current = id;
              speak("Pas de tâche prévue aujourd'hui. Belle journée !");
            }
          }
        } catch (err: any) {
          addMessage("assistant", "❌ Impossible de récupérer les tâches Notion. Vérifie la connexion.");
        } finally {
          setIsTyping(false);
        }
        return;
      }

      // Default: send to Hermes AI
      addMessage("user", command);
      sendMessageToHermes(command);
    },
    [addMessage, sendMessageToHermes, muted, speak]
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

      {/* VPS Metrics Panel */}
      <VPSMetrics />

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
          {/* Conversation Mode Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleConversationMode}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              conversationMode
                ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 animate-pulse"
                : "bg-white/5 border border-white/10 text-white/40 hover:text-white/70"
            }`}
            title={conversationMode ? "Mode conversation actif" : "Activer mode conversation"}
          >
            {conversationMode ? <Ear className="w-4 h-4" /> : <EarOff className="w-4 h-4" />}
          </motion.button>

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

        {/* Conversation Mode Indicator */}
        <AnimatePresence>
          {conversationMode && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-4 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20"
            >
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Mode Conversation
              </span>
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
          {conversationMode
            ? "Parlez naturellement — JARVIS écoute en continu"
            : "Interface de contrôle vocale — Prototype v0.4"}
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
