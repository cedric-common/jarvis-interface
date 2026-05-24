"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, CalendarClock, CloudSun, ListTodo, RadioTower, Server, Send, ShieldCheck, Zap } from "lucide-react";

type WeatherData = {
  location?: string;
  description?: string;
  temperature?: number;
  apparentTemperature?: number;
  windSpeed?: number;
  precipitationProbability?: number;
};

type StatusData = {
  vpsCount?: number;
  sitesCount?: number;
  onlineVps?: number;
  totalVps?: number;
  timestamp?: string;
  error?: string;
};

type TaskData = {
  title: string;
  client?: string;
  status?: string;
};

type VpsData = {
  id: number;
  hostname: string;
  state: string;
  cpuPercent: number;
  ramPercent: number;
};

interface CockpitDashboardProps {
  onAction: (command: string) => void;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function compactHostname(hostname: string) {
  return hostname.replace(".hstgr.cloud", "").replace("hermes.common.team", "hermes");
}

export default function CockpitDashboard({ onAction }: CockpitDashboardProps) {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [vms, setVms] = useState<VpsData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [weatherRes, statusRes, tasksRes, vpsRes] = await Promise.allSettled([
          fetch("/api/weather", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/status", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/notion-tasks", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/vps-metrics", { cache: "no-store" }).then((r) => r.json()),
        ]);

        if (cancelled) return;
        if (weatherRes.status === "fulfilled" && !weatherRes.value.error) setWeather(weatherRes.value);
        if (statusRes.status === "fulfilled") setStatus(statusRes.value);
        if (tasksRes.status === "fulfilled" && Array.isArray(tasksRes.value.tasks)) setTasks(tasksRes.value.tasks);
        if (vpsRes.status === "fulfilled" && Array.isArray(vpsRes.value.vms)) setVms(vpsRes.value.vms);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const refresh = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, []);

  const todayLabel = useMemo(
    () => now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
    [now]
  );

  const urgentTasks = tasks.filter((task) => (task.status || "").toLowerCase().includes("urgent"));
  const runningVps = vms.filter((vm) => vm.state === "running").length || status?.onlineVps || 0;
  const totalVps = vms.length || status?.totalVps || status?.vpsCount || 0;
  const infraOk = totalVps > 0 && runningVps === totalVps;

  const cards = [
    {
      title: "Aujourd'hui",
      icon: CalendarClock,
      accent: "text-cyan-300",
      body: loading ? "Synchronisation…" : `${todayLabel} · ${formatTime(now)}`,
      detail: weather
        ? `${Math.round(weather.temperature ?? 0)}°C à ${weather.location ?? "Solenzara"} · ${weather.description ?? "météo OK"}`
        : "Météo en attente",
      action: "Fais-moi le brief du jour",
    },
    {
      title: "Tâches",
      icon: ListTodo,
      accent: urgentTasks.length ? "text-rose-300" : "text-amber-300",
      body: `${tasks.length} tâche${tasks.length > 1 ? "s" : ""} Cédric`,
      detail: urgentTasks.length ? `${urgentTasks.length} urgente${urgentTasks.length > 1 ? "s" : ""}` : tasks[0]?.title ?? "Rien d'urgent détecté",
      action: "Mes tâches du jour",
    },
    {
      title: "Infrastructure",
      icon: Server,
      accent: infraOk ? "text-emerald-300" : "text-orange-300",
      body: `${runningVps}/${totalVps || "?"} VPS actifs`,
      detail: `${status?.sitesCount ?? "—"} sites Hostinger · ${infraOk ? "stable" : "à vérifier"}`,
      action: "État du serveur hermes",
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.25, type: "spring", stiffness: 90 }}
      className="fixed left-3 right-3 top-[74px] z-20 sm:left-4 sm:right-auto sm:top-20 sm:w-[360px] lg:w-[390px] pointer-events-auto"
      aria-label="Cockpit JARVIS"
    >
      <div className="glass-panel rounded-3xl border-glow overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-cyan-300/70">Cockpit v1</p>
            <h2 className="text-lg font-semibold text-white">Tableau de bord</h2>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            LIVE
          </div>
        </div>

        <div className="p-3 grid grid-cols-1 gap-2 max-h-[42vh] overflow-y-auto sm:max-h-none">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                onClick={() => onAction(card.action)}
                className="group text-left rounded-2xl border border-white/10 bg-white/[0.035] hover:bg-white/[0.07] transition-all p-3"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${card.accent}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-white/35">{card.title}</p>
                      <Zap className="w-3 h-3 text-white/15 group-hover:text-cyan-300/70" />
                    </div>
                    <p className="mt-1 text-sm font-medium text-white truncate">{card.body}</p>
                    <p className="mt-0.5 text-xs text-white/45 line-clamp-1">{card.detail}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-3 pb-3 grid grid-cols-2 gap-2">
          <button onClick={() => onAction("Liste mes VPS")} className="rounded-2xl bg-cyan-500/10 border border-cyan-400/20 px-3 py-2 text-xs font-mono text-cyan-200 flex items-center justify-center gap-2">
            <RadioTower className="w-3.5 h-3.5" /> VPS
          </button>
          <button onClick={() => onAction("Liste mes sites web")} className="rounded-2xl bg-violet-500/10 border border-violet-400/20 px-3 py-2 text-xs font-mono text-violet-200 flex items-center justify-center gap-2">
            <Activity className="w-3.5 h-3.5" /> Sites
          </button>
          <button onClick={() => onAction("Quel temps fait-il à Solenzara ?")} className="rounded-2xl bg-amber-500/10 border border-amber-400/20 px-3 py-2 text-xs font-mono text-amber-200 flex items-center justify-center gap-2">
            <CloudSun className="w-3.5 h-3.5" /> Météo
          </button>
          <button onClick={() => onAction("Envoie-moi le rapport sur Telegram")} className="rounded-2xl bg-emerald-500/10 border border-emerald-400/20 px-3 py-2 text-xs font-mono text-emerald-200 flex items-center justify-center gap-2">
            <Send className="w-3.5 h-3.5" /> Rapport
          </button>
        </div>

        {vms.length > 0 && (
          <div className="hidden sm:block px-4 pb-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-white/35">
                <ShieldCheck className="w-3 h-3 text-emerald-300" /> Santé VPS
              </div>
              {vms.slice(0, 4).map((vm) => (
                <div key={vm.id} className="flex items-center justify-between gap-3 text-[11px] font-mono">
                  <span className="text-white/55 truncate">{compactHostname(vm.hostname)}</span>
                  <span className="text-white/35">CPU {Math.round(vm.cpuPercent)}% · RAM {Math.round(vm.ramPercent)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
