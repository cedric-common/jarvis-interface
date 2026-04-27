"use client";

import { useEffect, useRef } from "react";

interface WaveformProps {
  isActive: boolean;
  intensity?: number;
}

export default function Waveform({ isActive, intensity = 1 }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let tick = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      tick++;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (!isActive) {
        // Idle state: subtle flat line
        ctx.strokeStyle = "rgba(0, 212, 255, 0.2)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        // Small pulses
        const pulseX = (tick * 0.5) % w;
        ctx.beginPath();
        ctx.arc(pulseX, h / 2, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 212, 255, 0.4)";
        ctx.fill();

        animId = requestAnimationFrame(draw);
        return;
      }

      // Active waveform
      const bars = 60;
      const barWidth = w / bars;
      const centerY = h / 2;

      for (let i = 0; i < bars; i++) {
        const x = i * barWidth + barWidth / 2;

        // Multiple sine waves for organic feel
        const t = tick * 0.08;
        const distFromCenter = Math.abs(i - bars / 2) / (bars / 2);
        const envelope = 1 - distFromCenter * 0.6;

        const wave1 = Math.sin(t + i * 0.3) * 20;
        const wave2 = Math.sin(t * 1.5 + i * 0.5) * 15;
        const wave3 = Math.sin(t * 0.7 + i * 0.2) * 10;
        const noise = (Math.random() - 0.5) * 8;

        const barHeight = Math.abs((wave1 + wave2 + wave3 + noise) * envelope * intensity) + 2;

        // Color gradient based on height
        const hue = 180 + (barHeight / 40) * 60;
        const alpha = 0.3 + (barHeight / 40) * 0.7;

        // Mirror bars
        ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
        ctx.fillRect(x - barWidth * 0.4, centerY - barHeight, barWidth * 0.8, barHeight * 2);

        // Glow on top
        ctx.fillStyle = `hsla(${hue}, 100%, 80%, ${alpha * 0.5})`;
        ctx.fillRect(x - barWidth * 0.2, centerY - barHeight - 2, barWidth * 0.4, 2);
        ctx.fillRect(x - barWidth * 0.2, centerY + barHeight, barWidth * 0.4, 2);
      }

      // Center glow line
      ctx.strokeStyle = "rgba(0, 212, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(w, centerY);
      ctx.stroke();

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [isActive, intensity]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
    />
  );
}
