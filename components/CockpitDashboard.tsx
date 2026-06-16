"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, CalendarClock, CloudSun, ListTodo, LogOut, Mail, RadioTower, Server, Send, ShieldCheck, Zap } from "lucide-react";
import { Profile } from "@/types/profile";

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
  id?: string;
  title: string;
  client?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  bucket?: "overdue" | "today" | "upcoming" | "unscheduled";
};

type GmailData = {
  count: number;
  messages: Array<{
    id: string;
    subject: string;
    from: string;
    snippet: string;
    date: string;
  }>;
};

type VpsData = {
  id: number;
  hostname: string;
  state: string;
  ip?: string;
  plan?: string;
  cpuPercent: number;
  ramPercent: number;
};

interface CockpitDashboardProps {
  onAction: (command: string) => void;
  profile?: Profile;
  onLogout?: () => void;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function compactHostname(hostname: string) {
  return hostname.replace(".hstgr.cloud", "").replace("hermes.common.team", "hermes");
}

function formatTaskDate(date?: string | null) {
  if (!date) return "Sans date";
  return new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function taskTone(task: TaskData) {
  const combined = `${task.status || ""} ${task.priority || ""}`.toLowerCase();
  if (task.bucket === "overdue") return "text-rose-200 border-rose-300/20 bg-rose-500/10";
  if (combined.includes("urgent") || combined.includes("haute")) return "text-orange-200 border-orange-300/20 bg-orange-500/10";
  if (task.bucket === "today") return "text-cyan-200 border-cyan-300/20 bg-cyan-500/10";
  return "text-white/55 border-white/10 bg-white/[0.03]";
}

function firstName(fullName?: string | null) {
  if (!fullName) return "";
  return fullName.split(" ")[0];
}

export default function CockpitDashboard({ onAction, profile, onLogout }: CockpitDashboardProps) {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [vms, setVms] = useState<VpsData[]>([]);
  const [gmail, setGmail] = useState<GmailData | null>(null);
  const [gmailError, setGmailError] = useState(false);
  const [showGmailPanel, setShowGmailPanel] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [weatherRes, statusRes, tasksRes, vpsRes, gmailRes] = await Promise.allSettled([
          fetch("/api/weather", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/status", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/notion-tasks", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/vps-metrics", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/gmail/unread", { cache: "no-store" }).then((r) => r.json()),
        ]);

        if (cancelled) return;
        if (weatherRes.status === "fulfilled" && !weatherRes.value.error) setWeather(weatherRes.value);
        if (statusRes.status === "fulfilled") setStatus(statusRes.value);
        if (tasksRes.status === "fulfilled" && Array.isArray(tasksRes.value.tasks)) setTasks(tasksRes.value.tasks);
        if (vpsRes.status === "fulfilled" && Array.isArray(vpsRes.value.vms)) setVms(vpsRes.value.vms);
        if (gmailRes.status === "fulfilled" && typeof gmailRes.value.count === "number") {
          setGmail(gmailRes.value);
          setGmailError(false);
        } else if (gmailRes.status === "fulfilled" && gmailRes.value.error) {
          setGmailError(true);
        }
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

  const overdueTasks = tasks.filter((task) => task.bucket === "overdue");
  const todayTasks = tasks.filter((task) => task.bucket === "today");
  const upcomingTasks = tasks.filter((task) => task.bucket === "upcoming");
  const urgentTasks = tasks.filter((task) => {
    const combined = `${task.status || ""} ${task.priority || ""}`.toLowerCase();
    return combined.includes("urgent") || combined.includes("haute");
  });
  const priorityTasks = [...overdueTasks, ...todayTasks, ...urgentTasks, ...upcomingTasks]
    .filter((task, index, list) => list.findIndex((candidate) => candidate.id === task.id && candidate.title === task.title) === index)
    .slice(0, 4);
  const inactiveVps = vms.filter((vm) => vm.state !== "running");
  const primaryInactiveVps = inactiveVps[0];
  const runningVps = vms.filter((vm) => vm.state === "running").length || status?.onlineVps || 0;
  const totalVps = vms.length || status?.totalVps || status?.vpsCount || 0;
  const infraOk = totalVps > 0 && runningVps === totalVps;

  const cards = [
    {
      title: "Aujourd'hui",
      icon: CalendarClock,
      accent: "text-cyan-300",
      body: loading ? "Synchronisation…" : `${todayLabel} · ${formatTime(now)}`,
      detail: loading
        ? "Météo et tâches en attente"
        : `${weather ? `${Math.round(weather.temperature ?? 0)}°C · ` : ""}${overdueTasks.length} retard · ${todayTasks.length} aujourd'hui · ${upcomingTasks.length} à venir`,
      onClick: () => onAction("Résume ma journée"),
    },
    {
      title: "Tâches",
      icon: ListTodo,
      accent: urgentTasks.length ? "text-rose-300" : "text-amber-300",
      body: `${tasks.length} tâche${tasks.length > 1 ? "s" : ""}`,
      detail: urgentTasks.length ? `${urgentTasks.length} urgente${urgentTasks.length > 1 ? "s" : ""}` : tasks[0]?.title ?? "Rien d'urgent détecté",
      onClick: () => onAction("Mes tâches du jour"),
    },
    {
      title: "Gmail",
      icon: Mail,
      accent: gmailError ? "text-orange-300" : gmail && gmail.count > 0 ? "text-rose-300" : "text-emerald-300",
      body: loading
        ? "Synchronisation…"
        : gmailError
          ? "Non connecté"
          : `${gmail?.count ?? 0} non lu${(gmail?.count ?? 0) > 1 ? "s" : ""}`,
      detail: gmailError
        ? "Reconnecte-toi avec Google pour activer"
        : gmail && gmail.count > 0
          ? gmail.messages[0]?.subject ?? "Nouveaux messages"
          : "Boîte de réception vide",
      onClick: () => setShowGmailPanel(!showGmailPanel),
    },
    {
      title: "Infrastructure",
      icon: Server,
      accent: infraOk ? "text-emerald-300" : "text-orange-300",
      body: `${runningVps}/${totalVps || "?"} VPS actifs`,
      detail: infraOk
        ? `${status?.sitesCount ?? "—"} sites Hostinger · stable`
        : `${primaryInactiveVps ? compactHostname(primaryInactiveVps.hostname) : "1 VPS"} ${primaryInactiveVps?.state ?? "à vérifier"}`,
      onClick: () => onAction(primaryInactiveVps ? `Diagnostique le VPS ${primaryInactiveVps.hostname}` : "État du serveur hermes"),
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
            <h2 className="text-lg font-semibold text-white">
              {profile?.full_name ? `Bonjour ${firstName(profile.full_name)}` : "Tableau de bord"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onLogout && (
              <button
                onClick={onLogout}
                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-1.5 text-[10px] font-mono text-white/60 flex items-center gap-1 transition-colors"
                title="Se déconnecter"
              >
                <LogOut className="w-3 h-3" />
              </button>
            )}
            <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              LIVE
            </div>
          </div>
        </div>

        <div className="p-3 grid grid-cols-1 gap-2 max-h-[42vh] overflow-y-auto sm:max-h-none">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                onClick={card.onClick}
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

        {/* Gmail Panel */}
        {showGmailPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-3 mb-3 rounded-2xl border border-white/10 bg-black/20 overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/35 flex items-center gap-2">
                <Mail className="w-3 h-3" /> Gmail non lus
              </span>
              <button
                onClick={() => setShowGmailPanel(false)}
                className="text-[10px] text-white/30 hover:text-white/60"
              >
                Fermer
              </button>
            </div>
            <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
              {gmailError ? (
                <p className="text-xs text-white/45 px-2 py-3">Gmail non connecté. Reconnecte-toi avec Google.</p>
              ) : gmail && gmail.count > 0 ? (
                gmail.messages.map((msg) => (
                  <a
                    key={msg.id}
                    href={`https://mail.google.com/mail/u/0/#inbox/${msg.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl px-2.5 py-2 hover:bg-white/[0.07] transition-colors"
                  >
                    <p className="text-[11px] font-medium text-white truncate">{msg.subject}</p>
                    <p className="text-[10px] text-white/45 truncate">{msg.from}</p>
                    <p className="text-[10px] text-white/30 line-clamp-1 mt-0.5">{msg.snippet}</p>
                  </a>
                ))
              ) : (
                <p className="text-xs text-white/45 px-2 py-3">Aucun email non lu.</p>
              )}
            </div>
          </motion.div>
        )}

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
          <button onClick={() => onAction("Résume ma journée")} className="rounded-2xl bg-emerald-500/10 border border-emerald-400/20 px-3 py-2 text-xs font-mono text-emerald-200 flex items-center justify-center gap-2">
            <Send className="w-3.5 h-3.5" /> Journée
          </button>
        </div>

        <div className="px-4 pb-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-widest text-white/35">
              <span>Plan aujourd'hui</span>
              <span className={overdueTasks.length ? "text-rose-300" : "text-emerald-300"}>
                {overdueTasks.length ? `${overdueTasks.length} retard` : "à jour"}
              </span>
            </div>
            {priorityTasks.length > 0 ? (
              priorityTasks.map((task) => (
                <button
                  key={`${task.id || task.title}-${task.dueDate || "none"}`}
                  onClick={() => onAction(`Ouvre ou résume la tâche Notion : ${task.title}`)}
                  className={`w-full rounded-xl border px-2.5 py-2 text-left text-[11px] transition-colors hover:bg-white/[0.07] ${taskTone(task)}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{task.title}</span>
                    <span className="shrink-0 font-mono opacity-70">{formatTaskDate(task.dueDate)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] opacity-65">
                    <span className="truncate">{task.client || "Général"}</span>
                    <span className="shrink-0">{task.priority || task.status || "à traiter"}</span>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-xs text-white/45">
                {profile?.full_name
                  ? `Aucune tâche urgente ou planifiée pour ${firstName(profile.full_name)} dans Notion.`
                  : "Aucune tâche urgente ou planifiée dans Notion."}
              </p>
            )}
          </div>
        </div>

        {vms.length > 0 && (
          <div className="hidden sm:block px-4 pb-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-widest text-white/35">
                <span className="flex items-center gap-2">
                  <ShieldCheck className={`w-3 h-3 ${infraOk ? "text-emerald-300" : "text-orange-300"}`} /> Santé VPS
                </span>
                {!infraOk && <span className="text-orange-300">{inactiveVps.length} à vérifier</span>}
              </div>
              {vms.slice(0, 4).map((vm) => (
                <div key={vm.id} className="flex items-center justify-between gap-3 text-[11px] font-mono">
                  <span className="text-white/55 truncate">{compactHostname(vm.hostname)}</span>
                  {vm.state === "running" ? (
                    <span className="text-white/35">CPU {Math.round(vm.cpuPercent)}% · RAM {Math.round(vm.ramPercent)}%</span>
                  ) : (
                    <button
                      onClick={() => onAction(`Diagnostique le VPS ${vm.hostname}`)}
                      className="rounded-full border border-orange-300/20 bg-orange-500/10 px-2 py-0.5 text-orange-200"
                    >
                      {vm.state}
                    </button>
                  )}
                </div>
              ))}
              {!infraOk && primaryInactiveVps && (
                <div className="mt-2 rounded-xl border border-orange-300/15 bg-orange-500/10 p-2 text-[11px] text-orange-100/80">
                  VPS non actif : <span className="font-mono text-orange-100">{compactHostname(primaryInactiveVps.hostname)}</span>
                  {primaryInactiveVps.ip && primaryInactiveVps.ip !== "N/A" ? ` · ${primaryInactiveVps.ip}` : " · aucune IPv4"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
