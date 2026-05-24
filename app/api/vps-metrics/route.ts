import { NextResponse } from "next/server";

const HOSTINGER_TOKEN = process.env.HOSTINGER_API_TOKEN;
const BASE_URL = "https://developers.hostinger.com/api";

interface VPSMetrics {
  id: number;
  hostname: string;
  state: string;
  ip: string;
  plan: string;
  cpus: number;
  memory: number; // MB
  disk: number; // MB
  cpuPercent: number;
  ramUsed: number; // MB
  ramPercent: number;
  uptime: string;
}

export async function GET() {
  if (!HOSTINGER_TOKEN) {
    return NextResponse.json({ error: "No token" }, { status: 500 });
  }

  const headers = { Authorization: `Bearer ${HOSTINGER_TOKEN}` };

  try {
    // 1. List VMs
    const vmsRes = await fetch(`${BASE_URL}/vps/v1/virtual-machines`, { headers });
    if (!vmsRes.ok) throw new Error(`VMs fetch failed: ${vmsRes.status}`);
    const vms = (await vmsRes.json()).filter((vm: { state?: string; status?: string }) => (vm.state || vm.status) !== "destroyed");

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dateFrom = yesterday.toISOString().split("T")[0];
    const dateTo = now.toISOString().split("T")[0];

    const metrics: VPSMetrics[] = [];

    for (const vm of vms) {
      // 2. Fetch metrics for each VM
      let cpuPercent = 0;
      let ramUsed = 0;
      let ramPercent = 0;

      try {
        const metricsRes = await fetch(
          `${BASE_URL}/vps/v1/virtual-machines/${vm.id}/metrics?date_from=${dateFrom}&date_to=${dateTo}`,
          { headers }
        );
        if (metricsRes.ok) {
          const m = await metricsRes.json();

          // CPU: take latest value
          if (m.cpu_usage?.usage) {
            const cpuValues = Object.values(m.cpu_usage.usage) as number[];
            cpuPercent = cpuValues[cpuValues.length - 1] || 0;
          }

          // RAM: take latest value (in bytes, convert to MB)
          if (m.ram_usage?.usage) {
            const ramValues = Object.values(m.ram_usage.usage) as number[];
            const latestBytes = ramValues[ramValues.length - 1] || 0;
            ramUsed = Math.round(latestBytes / 1024 / 1024);
            ramPercent = Math.round((ramUsed / vm.memory) * 100);
          }
        }
      } catch {
        // Silently skip metrics errors
      }

      // Calculate uptime from created_at
      const createdAt = new Date(vm.created_at);
      const diffMs = now.getTime() - createdAt.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const uptimeStr = diffDays > 0 ? `${diffDays}j ${diffHours}h` : `${diffHours}h`;

      metrics.push({
        id: vm.id,
        hostname: vm.hostname,
        state: vm.state,
        ip: vm.ipv4?.[0]?.address || "N/A",
        plan: vm.plan,
        cpus: vm.cpus,
        memory: vm.memory,
        disk: Math.round(vm.disk / 1024), // MB → GB
        cpuPercent: Math.round(cpuPercent * 10) / 10,
        ramUsed,
        ramPercent,
        uptime: uptimeStr,
      });
    }

    return NextResponse.json({ vms: metrics, updatedAt: now.toISOString() });
  } catch (err: any) {
    console.error("VPS metrics error:", err);
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
