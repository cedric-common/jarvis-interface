"use client";

import { motion } from "framer-motion";
import { Server, Globe, ListTodo, Cloud, Activity, Zap } from "lucide-react";

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  command: string;
}

const actions: QuickAction[] = [
  {
    id: "vps",
    label: "VPS",
    icon: <Server className="w-4 h-4" />,
    color: "from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-300",
    command: "Liste mes VPS",
  },
  {
    id: "sites",
    label: "Sites",
    icon: <Globe className="w-4 h-4" />,
    color: "from-violet-500/20 to-purple-500/20 border-violet-500/30 text-violet-300",
    command: "Liste mes sites web",
  },
  {
    id: "tasks",
    label: "Tâches",
    icon: <ListTodo className="w-4 h-4" />,
    color: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-300",
    command: "Mes tâches du jour",
  },
  {
    id: "deploy",
    label: "Déployer",
    icon: <Cloud className="w-4 h-4" />,
    color: "from-emerald-500/20 to-green-500/20 border-emerald-500/30 text-emerald-300",
    command: "Déploie le dernier commit",
  },
  {
    id: "status",
    label: "Statut",
    icon: <Activity className="w-4 h-4" />,
    color: "from-rose-500/20 to-red-500/20 border-rose-500/30 text-rose-300",
    command: "État du serveur hermes",
  },
  {
    id: "boost",
    label: "Action",
    icon: <Zap className="w-4 h-4" />,
    color: "from-white/10 to-white/5 border-white/20 text-white",
    command: "Que puis-je faire ?",
  },
];

interface QuickActionsProps {
  onAction: (command: string) => void;
}

export default function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, type: "spring", stiffness: 100 }}
      className="fixed bottom-3 sm:bottom-8 left-1/2 -translate-x-1/2 z-20 w-[calc(100vw-1.5rem)] max-w-sm sm:w-auto sm:max-w-none pb-[env(safe-area-inset-bottom)]"
    >
      <div className="glass-panel rounded-2xl px-3 py-3 grid grid-cols-3 sm:flex sm:items-center gap-2 border-glow">
        {actions.map((action, i) => (
          <motion.button
            key={action.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + i * 0.05 }}
            whileHover={{ y: -2, scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onAction(action.command)}
            className={`flex flex-col items-center justify-center gap-1.5 min-h-14 px-2 sm:px-3 py-2 rounded-xl bg-gradient-to-b ${action.color} border transition-all hover:brightness-125`}
            aria-label={action.command}
          >
            {action.icon}
            <span className="text-[10px] font-mono uppercase tracking-wider">{action.label}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
