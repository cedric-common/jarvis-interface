"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
}

export default function HUDCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let mouseX = 0;
    let mouseY = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouse = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener("mousemove", handleMouse);

    // Particles
    const particles: Particle[] = [];
    const colors = ["#00d4ff", "#0066ff", "#7c3aed", "#00d4ff"];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let tick = 0;

    const draw = () => {
      tick++;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      // Clear with trail effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(0, 0, w, h);

      // Radial gradient background
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
      gradient.addColorStop(0, "rgba(0, 40, 80, 0.08)");
      gradient.addColorStop(0.5, "rgba(0, 10, 30, 0.04)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      // Concentric rotating rings
      const rings = [
        { radius: 180, speed: 0.002, segments: 60, gap: 4, color: "rgba(0, 212, 255, 0.15)" },
        { radius: 260, speed: -0.0015, segments: 90, gap: 3, color: "rgba(0, 102, 255, 0.12)" },
        { radius: 340, speed: 0.001, segments: 120, gap: 2, color: "rgba(124, 58, 237, 0.1)" },
      ];

      rings.forEach((ring, idx) => {
        const angleOffset = tick * ring.speed;
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 1;
        const segAngle = (Math.PI * 2) / ring.segments;

        for (let i = 0; i < ring.segments; i += ring.gap) {
          const a1 = i * segAngle + angleOffset;
          const a2 = (i + 1) * segAngle + angleOffset;
          ctx.beginPath();
          ctx.arc(cx, cy, ring.radius, a1, a2);
          ctx.stroke();
        }

        // Tick marks on outer rings
        if (idx === 2) {
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2 - angleOffset * 2;
            const x1 = cx + Math.cos(a) * (ring.radius - 8);
            const y1 = cy + Math.sin(a) * (ring.radius - 8);
            const x2 = cx + Math.cos(a) * ring.radius;
            const y2 = cy + Math.sin(a) * ring.radius;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = "rgba(0, 212, 255, 0.2)";
            ctx.stroke();
          }
        }
      });

      // Crosshair lines (subtle)
      ctx.strokeStyle = "rgba(0, 212, 255, 0.05)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - 400, cy);
      ctx.lineTo(cx - 100, cy);
      ctx.moveTo(cx + 100, cy);
      ctx.lineTo(cx + 400, cy);
      ctx.moveTo(cx, cy - 300);
      ctx.lineTo(cx, cy - 100);
      ctx.moveTo(cx, cy + 100);
      ctx.lineTo(cx, cy + 300);
      ctx.stroke();

      // Particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Mouse repulsion
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150 && dist > 0) {
          const force = (150 - dist) / 150;
          p.vx += (dx / dist) * force * 0.5;
          p.vy += (dy / dist) * force * 0.5;
        }

        // Damping
        p.vx *= 0.99;
        p.vy *= 0.99;

        // Wrap
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        // Draw
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Connect nearby particles
      ctx.strokeStyle = "rgba(0, 212, 255, 0.08)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.globalAlpha = (1 - dist / 120) * 0.3;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ background: "#000000" }}
    />
  );
}
