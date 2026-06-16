"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, CalendarClock, CloudSun, ListTodo, LogOut, Mail, RadioTower, Server, Send, ShieldCheck, Zap, Plus, Calendar } from "lucide-react";
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
  url?: string;
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

type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  isAllDay: boolean;
  location?: string;
  hangoutLink?: string;
  attendeeCount: number;
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
  onContextChange?: (ctx: { tasks: TaskData[]; emails: any[]; vps: VpsData[]; calendar: CalendarEvent[] }) => void;
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

export default function CockpitDashboard({ onAction, profile, onLogout, onContextChange }: CockpitDashboardProps) {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [vms, setVms] = useState<VpsData[]>([]);
  const [gmail, setGmail] = useState<GmailData | null>(null);
  const [gmailError, setGmailError] = useState(false);
  const [showGmailPanel, setShowGmailPanel] = useState(false);
  const [calendar, setCalendar] = useState<CalendarEvent[]>([]);
  const [calendarError, setCalendarError] = useState(false);
  const [showNotionPanel, setShowNotionPanel] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [createTaskLoading, setCreateTaskLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [weatherRes, statusRes, tasksRes, vpsRes, gmailRes, calendarRes] = await Promise.allSettled([
          fetch("/api/weather", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/status", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/notion-tasks", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/vps-metrics", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/gmail/unread", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/google/calendar", { cache: "no-store" }).then((r) => r.json()),
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
        if (calendarRes.status === "fulfilled" && Array.isArray(calendarRes.value.events)) {
          setCalendar(calendarRes.value.events);
          setCalendarError(false);
        } else if (calendarRes.status === "fulfilled" && calendarRes.value.error) {
          setCalendarError(true);
        }
        // Notify parent of context snapshot
        if (onContextChange && !cancelled) {
          onContextChange({
            tasks: tasksRes.status === "fulfilled" && Array.isArray(tasksRes.value.tasks) ? tasksRes.value.tasks : [],
            emails: gmailRes.status === "fulfilled" && gmailRes.value.messages ? gmailRes.value.messages : [],
            vps: vpsRes.status === "fulfilled" && Array.isArray(vpsRes.value.vms) ? vpsRes.value.vms : [],
            calendar: calendarRes.status === "fulfilled" && Array.isArray(calendarRes.value.events) ? calendarRes.value.events : [],
          });
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

  const handleCreateTask = async (title: string, date?: string, assigneeId?: string, clientId?: string) => {
    setCreateTaskLoading(true);
    try {
      const res = await fetch("/api/notion/create-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, date, assigneeId, clientId }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateTask(false);
        // Refresh tasks
        const tasksRes = await fetch("/api/notion-tasks", { cache: "no-store" }).then((r) => r.json());
        if (Array.isArray(tasksRes.tasks)) setTasks(tasksRes.tasks);
      } else {
        alert(data.error || "Erreur lors de la création");
      }
    } catch {
      alert("Erreur réseau");
    } finally {
      setCreateTaskLoading(false);
    }
  };

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
      onClick: () => { setShowGmailPanel(false); setShowNotionPanel(!showNotionPanel); },
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
      onClick: () => { setShowNotionPanel(false); setShowGmailPanel(!showGmailPanel); },
    },
    {
      title: "Calendrier",
      icon: Calendar,
      accent: calendarError ? "text-orange-300" : calendar.length > 0 ? "text-violet-300" : "text-white/35",
      body: loading
        ? "Synchronisation…"
        : calendarError
          ? "Non connecté"
          : `${calendar.length} événement${calendar.length > 1 ? "s" : ""}`,
      detail: calendarError
        ? "Reconnecte-toi avec Google pour activer"
        : calendar.length > 0
          ? calendar[0].summary
          : "Aucun événement aujourd'hui",
      onClick: () => onAction("Quel est mon prochain rendez-vous ?"),
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
      initial={{ opacity: 0, x: -80, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ delay: 0.15, type: "spring", stiffness: 70, damping: 18 }}
      className="fixed left-3 right-3 top-[74px] z-20 sm:left-4 sm:right-auto sm:top-20 sm:w-[360px] lg:w-[390px] pointer-events-auto"
      aria-label="Cockpit JARVIS"
    >
      <div className="glass-panel rounded-3xl border-glow overflow-visible relative">
        {/* Backdrop: close panels on click outside */}
        {(showGmailPanel || showNotionPanel) && (
          <div
            className="fixed inset-0 z-10"
            onClick={() => { setShowGmailPanel(false); setShowNotionPanel(false); }}
          />
        )}
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
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || ""}
                className="w-7 h-7 rounded-full border border-white/20 object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full border border-white/20 bg-white/10 flex items-center justify-center text-[10px] font-medium text-white/70">
                {firstName(profile?.full_name)?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )}
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
            className="mx-3 mb-3 rounded-2xl border border-white/10 bg-black/20 overflow-hidden sm:absolute sm:left-full sm:top-0 sm:ml-3 sm:w-[320px] lg:w-[340px] sm:mb-0 sm:mx-0 sm:glass-panel sm:border-glow"
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

        {/* Notion Panel */}
        {showNotionPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-3 mb-3 rounded-2xl border border-white/10 bg-black/20 overflow-hidden sm:absolute sm:left-full sm:top-0 sm:ml-3 sm:w-[320px] lg:w-[340px] sm:mb-0 sm:mx-0 sm:glass-panel sm:border-glow"
          >
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/35 flex items-center gap-2">
                <ListTodo className="w-3 h-3" /> Tâches Notion
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateTask(true)}
                  className="text-[10px] text-cyan-300/70 hover:text-cyan-300 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Ajouter
                </button>
                <button
                  onClick={() => setShowNotionPanel(false)}
                  className="text-[10px] text-white/30 hover:text-white/60"
                >
                  Fermer
                </button>
              </div>
            </div>
            <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
              {showCreateTask ? (
                <CreateTaskForm
                  onSubmit={handleCreateTask}
                  onCancel={() => setShowCreateTask(false)}
                  loading={createTaskLoading}
                />
              ) : tasks.length === 0 ? (
                <p className="text-xs text-white/45 px-2 py-3">Aucune tâche trouvée.</p>
              ) : (
                <>
                  {overdueTasks.length > 0 && (
                    <div className="px-2 py-1">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-rose-300/70 mb-1">En retard ({overdueTasks.length})</p>
                      {overdueTasks.map((task) => (
                        <a
                          key={task.id || task.title}
                          href={task.url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-xl px-2.5 py-2 hover:bg-white/[0.07] transition-colors mb-1"
                        >
                          <p className="text-[11px] font-medium text-white truncate">{task.title}</p>
                          <p className="text-[10px] text-white/45">{task.client || "Général"} · {formatTaskDate(task.dueDate)}</p>
                        </a>
                      ))}
                    </div>
                  )}
                  {todayTasks.length > 0 && (
                    <div className="px-2 py-1">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-300/70 mb-1">Aujourd'hui ({todayTasks.length})</p>
                      {todayTasks.map((task) => (
                        <a
                          key={task.id || task.title}
                          href={task.url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-xl px-2.5 py-2 hover:bg-white/[0.07] transition-colors mb-1"
                        >
                          <p className="text-[11px] font-medium text-white truncate">{task.title}</p>
                          <p className="text-[10px] text-white/45">{task.client || "Général"} · {task.priority || task.status || "à traiter"}</p>
                        </a>
                      ))}
                    </div>
                  )}
                  {upcomingTasks.length > 0 && (
                    <div className="px-2 py-1">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-white/35 mb-1">À venir ({upcomingTasks.length})</p>
                      {upcomingTasks.map((task) => (
                        <a
                          key={task.id || task.title}
                          href={task.url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-xl px-2.5 py-2 hover:bg-white/[0.07] transition-colors mb-1"
                        >
                          <p className="text-[11px] font-medium text-white truncate">{task.title}</p>
                          <p className="text-[10px] text-white/45">{task.client || "Général"} · {formatTaskDate(task.dueDate)}</p>
                        </a>
                      ))}
                    </div>
                  )}
                </>
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

/* ------------------------------------------------------------------ */
/* Quick-create task form                                               */
/* ------------------------------------------------------------------ */

function CreateTaskForm({
  onSubmit,
  onCancel,
  loading,
}: {
  onSubmit: (title: string, date?: string, assigneeId?: string, clientId?: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [clientId, setClientId] = useState("");
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notion/members", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.members)) setMembers(data.members);
      })
      .finally(() => setMembersLoading(false));

    fetch("/api/notion/clients", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          console.warn("Clients load error:", data.error);
          return;
        }
        if (Array.isArray(data.clients)) setClients(data.clients);
      })
      .catch(() => {})
      .finally(() => setClientsLoading(false));
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSubmit(title.trim(), date || undefined, assigneeId || undefined, clientId || undefined);
      }}
      className="p-2 space-y-2"
    >
      <input
        type="text"
        placeholder="Titre de la tâche..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/40"
        autoFocus
      />
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/40"
        />
        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          disabled={membersLoading}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white focus:outline-none focus:border-cyan-400/40 disabled:opacity-40 appearance-none"
        >
          <option value="" className="bg-black text-white/50">Non assigné</option>
          {members.map((m) => (
            <option key={m.id} value={m.id} className="bg-black text-white">
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <select
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        disabled={clientsLoading}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white focus:outline-none focus:border-cyan-400/40 disabled:opacity-40 appearance-none"
      >
        <option value="" className="bg-black text-white/50">Sans client</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id} className="bg-black text-white">
            {c.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="flex-1 rounded-xl bg-cyan-500/20 border border-cyan-400/30 px-3 py-2 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-40 transition-colors"
        >
          {loading ? "Création..." : "Créer"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/50 hover:text-white/80 transition-colors"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
