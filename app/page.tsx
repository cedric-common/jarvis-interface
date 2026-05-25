"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Volume2, VolumeX, Ear, EarOff } from "lucide-react";
import HUDCanvas from "@/components/HUDCanvas";
import Waveform from "@/components/Waveform";
import VoiceOrb from "@/components/VoiceOrb";
import ChatPanel, { Message } from "@/components/ChatPanel";
import CockpitDashboard from "@/components/CockpitDashboard";
import useSpeechRecognition from "@/hooks/useSpeechRecognition";
import useSpeechSynthesis from "@/hooks/useSpeechSynthesis";

export default function Home() {
  const [chatOpen, setChatOpen] = useState(false);
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
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    const frame = window.requestAnimationFrame(() => setChatOpen(!isMobile));
    return () => window.cancelAnimationFrame(frame);
  }, []);

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
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 75_000);
      const res = await fetch("/api/hermes", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      window.clearTimeout(timeout);

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

      const isDailySummary = command === "Fais-moi le brief du jour" || command === "Résume ma journée";
      const isTaskList = command === "Mes tâches du jour";

      function taskLabel(task: { bucket?: string; dueDate?: string | null; status?: string; priority?: string }) {
        if (task.bucket === "overdue") return "🔴 En retard";
        if (task.bucket === "today") return "🔵 Aujourd'hui";
        if ((`${task.status || ""} ${task.priority || ""}`).toLowerCase().includes("urgent")) return "🟠 Urgent";
        if (task.dueDate) return `🗓️ ${new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`;
        return "⏳ À traiter";
      }

      if (isDailySummary || isTaskList) {
        addMessage("user", command);
        setIsTyping(true);
        try {
          const [weatherRes, statusRes, tasksRes] = await Promise.all([
            fetch("/api/weather").then((r) => r.json()).catch(() => null),
            fetch("/api/status").then((r) => r.json()).catch(() => null),
            fetch("/api/notion-tasks").then((r) => r.json()).catch(() => null),
          ]);

          if (tasksRes?.error) {
            addMessage("assistant", `❌ Erreur Notion : ${tasksRes.error}`);
            return;
          }

          const tasks = Array.isArray(tasksRes?.tasks) ? tasksRes.tasks : [];
          const summary = tasksRes?.summary || {
            total: tasks.length,
            overdue: tasks.filter((task: { bucket?: string }) => task.bucket === "overdue").length,
            today: tasks.filter((task: { bucket?: string }) => task.bucket === "today").length,
            upcoming: tasks.filter((task: { bucket?: string }) => task.bucket === "upcoming").length,
            urgent: tasks.filter((task: { status?: string; priority?: string }) => (`${task.status || ""} ${task.priority || ""}`).toLowerCase().includes("urgent")).length,
          };

          const weatherLine = weatherRes && !weatherRes.error
            ? `🌤️ Solenzara : ${Math.round(weatherRes.temperature)}°C, ${weatherRes.description}. Vent ${Math.round(weatherRes.windSpeed)} km/h.`
            : "🌤️ Météo : indisponible pour le moment.";
          const infraLine = statusRes && !statusRes.error
            ? `🖥️ Infra : ${statusRes.onlineVps}/${statusRes.totalVps} VPS actifs, ${statusRes.sitesCount} sites Hostinger.`
            : "🖥️ Infra : statut indisponible.";

          if (isDailySummary) {
            const topTasks = tasks.slice(0, 4);
            const taskLines = topTasks.length
              ? topTasks.map((task: { title: string; client?: string; bucket?: string; dueDate?: string | null; status?: string; priority?: string }) => `- ${taskLabel(task)} — ${task.title}${task.client ? ` (${task.client})` : ""}`).join("\n")
              : "- Aucune tâche Cédric urgente ou planifiée détectée dans Notion.";
            const attention = summary.overdue > 0
              ? `⚠️ Priorité : ${summary.overdue} tâche${summary.overdue > 1 ? "s" : ""} en retard.`
              : summary.today > 0
              ? `✅ Focus : ${summary.today} tâche${summary.today > 1 ? "s" : ""} prévue${summary.today > 1 ? "s" : ""} aujourd'hui.`
              : "✅ Aucun retard détecté.";

            const response = `## Résumé de ta journée\n\n${weatherLine}\n${attention}\n📋 Notion : ${summary.total} tâche${summary.total > 1 ? "s" : ""} Cédric — ${summary.today} aujourd'hui, ${summary.upcoming} à venir, ${summary.urgent} urgente${summary.urgent > 1 ? "s" : ""}.\n\n${taskLines}\n\n${infraLine}`;
            const id = addMessage("assistant", response);
            if (!muted) {
              lastSpokenIdRef.current = id;
              speak(`Résumé de ta journée. ${attention} ${summary.total} tâches Cédric dans Notion. ${infraLine}`);
            }
            return;
          }

          if (tasks.length > 0) {
            const today = new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            });
            let response = `📋 **Tâches Cédric — ${today}**\n\n`;

            const sections: Array<[string, typeof tasks]> = [
              ["🔴 En retard", tasks.filter((task: { bucket?: string }) => task.bucket === "overdue")],
              ["🔵 Aujourd'hui", tasks.filter((task: { bucket?: string }) => task.bucket === "today")],
              ["🗓️ Prochaines échéances", tasks.filter((task: { bucket?: string }) => task.bucket === "upcoming")],
            ];

            for (const [label, sectionTasks] of sections) {
              if (!sectionTasks.length) continue;
              response += `**${label}**\n`;
              for (const task of sectionTasks.slice(0, 8)) {
                const meta = [task.client, task.priority || task.status, task.dueDate].filter(Boolean).join(" · ");
                response += `- ${task.title}${meta ? ` — ${meta}` : ""}\n`;
              }
              response += "\n";
            }

            const id = addMessage("assistant", response.trim());
            if (!muted) {
              lastSpokenIdRef.current = id;
              speak(`Tu as ${tasks.length} tâche${tasks.length > 1 ? "s" : ""} Cédric dans Notion, dont ${summary.overdue} en retard et ${summary.today} aujourd'hui.`);
            }
          } else {
            const id = addMessage(
              "assistant",
              "✨ **Aucune tâche Cédric urgente ou planifiée dans Notion.**\n\nJe ne montre pas les tâches des collaborateurs par défaut."
            );
            if (!muted) {
              lastSpokenIdRef.current = id;
              speak("Aucune tâche Cédric urgente ou planifiée dans Notion.");
            }
          }
        } catch {
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

      {/* Cockpit Dashboard */}
      <CockpitDashboard onAction={handleQuickAction} />

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
            aria-label={conversationMode ? "Désactiver le mode conversation" : "Activer le mode conversation"}
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
            aria-label={muted ? "Activer la voix" : "Couper la voix"}
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
            aria-label={chatOpen ? "Fermer la conversation" : "Ouvrir la conversation"}
          >
            {chatOpen ? <X className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
          </motion.button>
        </div>
      </motion.header>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pb-0">
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
    </main>
  );
}
