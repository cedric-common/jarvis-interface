"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Server, Cpu, HardDrive, Activity } from "lucide-react";

interface VPSData {
  id: number;
  hostname: string;
  state: string;
  ip: string;
  plan: string;
  cpus: number;
  memory: number;
  disk: number;
  cpuPercent: number;
  ramUsed: number;
  ramPercent: number;
  uptime: string;
}

export default function VPSMetrics() {
  const [vms, setVms] = useState<VPSData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch("/api/vps-metrics");
        const data = await res.json();
        if (data.vms) setVms(data.vms);
      } catch (err) {
        console.error("Metrics fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const runningCount = vms.filter((v) => v.state === "running").length;

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed top-20 right-4 z-20 glass-panel rounded-2xl px-4 py-3"
      >
        <div className="flex items-center gap-2 text-white/40">
          <Activity className="w-4 h-4 animate-pulse" />
          <span className="text-xs font-mono">Chargement métriques...</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
      className="fixed top-20 left-4 z-20 glass-panel rounded-2xl overflow-hidden border-glow"
      style={{ maxWidth: expanded ? 320 : 200 }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              runningCount === vms.length
                ? "bg-emerald-400 animate-pulse"
                : "bg-amber-400"
            }`}
          />
          <span className="text-xs font-mono text-white/60 uppercase tracking-wider">
            Infra
          </span>
        </div>
        <span className="text-[10px] font-mono text-white/30">
          {runningCount}/{vms.length} UP
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3">
              {vms.map((vm) => (
                <div
                  key={vm.id}
                  className="space-y-1.5 border-t border-white/5 pt-2 first:border-0 first:pt-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Server className="w-3 h-3 text-white/40" />
                      <span className="text-[11px] text-white/80 font-mono truncate max-w-[140px]">
                        {vm.hostname.replace(".hstgr.cloud", "")}
                      </span>
                    </div>
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        vm.state === "running"
                          ? "bg-emerald-400"
                          : "bg-rose-400"
                      }`}
                    />
                  </div>

                  {/* CPU Bar */}
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3 h-3 text-white/30 shrink-0" />
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          vm.cpuPercent > 80
                            ? "bg-rose-400"
                            : vm.cpuPercent > 50
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(vm.cpuPercent, 100)}%` }}
                        transition={{ type: "spring", stiffness: 100 }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-white/50 w-8 text-right">
                      {vm.cpuPercent}%
                    </span>
                  </div>

                  {/* RAM Bar */}
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-3 h-3 text-white/30 shrink-0" />
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          vm.ramPercent > 85
                            ? "bg-rose-400"
                            : vm.ramPercent > 60
                            ? "bg-amber-400"
                            : "bg-cyan-400"
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(vm.ramPercent, 100)}%` }}
                        transition={{ type: "spring", stiffness: 100 }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-white/50 w-8 text-right">
                      {vm.ramPercent}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[9px] font-mono text-white/25">
                    <span>{vm.plan}</span>
                    <span>Up {vm.uptime}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
