"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[JARVIS] Service Worker registered:", registration.scope);
        })
        .catch((error) => {
          console.error("[JARVIS] Service Worker registration failed:", error);
        });
    }
  }, []);

  return null;
}
