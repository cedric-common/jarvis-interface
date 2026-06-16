export const dynamic = "force-dynamic";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const KIMI_TIMEOUT_MS = 25_000;
const HERMES_TIMEOUT_MS = 60_000;

type ApiRecord = Record<string, unknown>;

function asRecord(value: unknown): ApiRecord {
  return value && typeof value === "object" ? (value as ApiRecord) : {};
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function getList(data: unknown): ApiRecord[] {
  if (Array.isArray(data)) return data.map(asRecord);
  const dataRecord = asRecord(data);
  return Array.isArray(dataRecord.data) ? dataRecord.data.map(asRecord) : [];
}

const WEATHER_CODES: Record<number, string> = {
  0: "ciel dégagé",
  1: "principalement dégagé",
  2: "partiellement nuageux",
  3: "couvert",
  45: "brouillard",
  48: "brouillard givrant",
  51: "bruine légère",
  53: "bruine modérée",
  55: "bruine dense",
  61: "pluie faible",
  63: "pluie modérée",
  65: "forte pluie",
  80: "averses faibles",
  81: "averses modérées",
  82: "averses fortes",
  95: "orage",
};

function sseText(text: string) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

function sseFromOpenAIStream(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return sseText("Je n'ai pas reçu de flux exploitable côté JARVIS.");

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data) continue;
            if (data === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`));
              }
            } catch {
              // Ignore malformed provider chunks.
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      reader.cancel().catch(() => undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function getWeatherAnswer() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", "41.858");
  url.searchParams.set("longitude", "9.399");
  url.searchParams.set("current", "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("timezone", "Europe/Paris");
  url.searchParams.set("forecast_days", "1");

  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const data = await res.json();
  const current = data.current ?? {};
  const daily = data.daily ?? {};
  const description = WEATHER_CODES[Number(current.weather_code)] ?? "conditions météo indisponibles";

  return `À Solenzara maintenant : ${Math.round(current.temperature_2m)}°C, ressenti ${Math.round(current.apparent_temperature)}°C, ${description}. Vent ${Math.round(current.wind_speed_10m)} km/h, rafales ${Math.round(current.wind_gusts_10m)} km/h. Aujourd'hui : ${Math.round(daily.temperature_2m_min?.[0])}–${Math.round(daily.temperature_2m_max?.[0])}°C, risque de pluie ${daily.precipitation_probability_max?.[0] ?? 0}%.`;
}

async function directAnswer(message: string) {
  const text = message.toLowerCase();
  if (text.includes("météo") || text.includes("meteo") || text.includes("temps") || text.includes("solenzara")) {
    return getWeatherAnswer();
  }
  return null;
}

const KIMI_SYSTEM_PROMPT = "Tu es Hermes Agent, l'assistant personnel de Cédric Tiberi dans l'interface JARVIS. Réponds en français, ton direct et efficace. Si une action réelle est demandée mais que tu n'as pas l'outil, dis-le clairement.";
const HERMES_SYSTEM_PROMPT = "Tu réponds depuis l'interface vocale JARVIS de Cédric. Réponds en français, concis et opérationnel. Utilise tes outils Hermes si nécessaire.";

function buildContextPrompt(context: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) return "";
  const parts: string[] = [];

  const tasks = Array.isArray(context.tasks) ? context.tasks : [];
  const emails = Array.isArray(context.emails) ? context.emails : [];
  const calendar = Array.isArray(context.calendar) ? context.calendar : [];

  if (tasks.length > 0) {
    const overdue = tasks.filter((t: any) => t.bucket === "overdue").length;
    const today = tasks.filter((t: any) => t.bucket === "today").length;
    const urgent = tasks.filter((t: any) => {
      const combined = `${t.status || ""} ${t.priority || ""}`.toLowerCase();
      return combined.includes("urgent") || combined.includes("haute");
    }).length;
    parts.push(`📋 Tâches Notion : ${tasks.length} au total — ${overdue} en retard, ${today} aujourd'hui, ${urgent} urgentes.`);
    if (overdue > 0) {
      const topOverdue = tasks.filter((t: any) => t.bucket === "overdue").slice(0, 3).map((t: any) => `- ${t.title}`).join("\n");
      parts.push("En retard :\n" + topOverdue);
    }
  }

  if (emails.length > 0) {
    parts.push(`📧 Gmail : ${emails.length} emails non lus. Derniers : ${emails.slice(0, 2).map((e: any) => e.subject).join(", ")}.`);
  }

  if (calendar.length > 0) {
    const next = calendar[0];
    const nextTime = next.start ? new Date(next.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
    parts.push(`📅 Prochain événement : "${next.summary}"${nextTime ? ` à ${nextTime}` : ""}.`);
    if (calendar.length > 1) {
      parts.push(`${calendar.length - 1} autre(s) événement(s) aujourd'hui.`);
    }
  }

  if (parts.length === 0) return "";
  return "\n\n--- Contexte JARVIS ---\n" + parts.join("\n") + "\n--- Fin contexte ---\n";
}

function normalizeHistory(history: unknown) {
  return Array.isArray(history)
    ? history.slice(-10).map((m) => {
        const item = asRecord(m);
        return {
          role: getString(item.role) === "user" ? "user" : "assistant",
          content: getString(item.content),
        };
      }).filter((m) => m.content)
    : [];
}

async function callHermes(message: string, history: unknown, systemPrompt: string) {
  const baseUrl = process.env.HERMES_API_URL?.replace(/\/$/, "");
  const apiKey = process.env.HERMES_API_KEY;
  if (!baseUrl || !apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HERMES_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "X-Hermes-Session-Id": "jarvis-web",
        "X-Hermes-Session-Key": "jarvis-cedric",
      },
      body: JSON.stringify({
        model: process.env.HERMES_MODEL || "hermes-agent",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...normalizeHistory(history),
          { role: "user", content: message },
        ],
      }),
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("Hermes API failed:", response.status, errorText.slice(0, 500));
      return null;
    }
    return response;
  } catch (error) {
    clearTimeout(timeout);
    console.error("Hermes API unavailable:", error);
    return null;
  }
}

async function callKimi(message: string, history: unknown, systemPrompt: string) {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KIMI_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.moonshot.ai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "kimi-k2.6",
        max_tokens: 2048,
        messages: [
          { role: "system", content: systemPrompt },
          ...normalizeHistory(history),
          { role: "user", content: message },
        ],
        stream: true,
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    return response;
  } catch (error) {
    clearTimeout(timeout);
    console.error("Kimi fallback unavailable:", error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    let userSystemPrompt: string | null = null;

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single<{ full_name?: string | null; role?: string | null }>();

      if (profile?.full_name) {
        userSystemPrompt = `Tu réponds depuis l'interface vocale JARVIS de ${profile.full_name}. ${profile.full_name} est ${profile.role || "collaborateur"} chez Comm'On. Réponds en français, concis et opérationnel. Utilise tes outils Hermes si nécessaire.`;
      }
    }

    const hermesPrompt = userSystemPrompt || HERMES_SYSTEM_PROMPT;
    const kimiPrompt = userSystemPrompt || KIMI_SYSTEM_PROMPT;

    const body = await request.json();
    const { message, history = [], context } = body;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message requis" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const contextPrompt = buildContextPrompt(context || {});
    const hermesPromptWithContext = hermesPrompt + contextPrompt;
    const kimiPromptWithContext = kimiPrompt + contextPrompt;

    const handled = await directAnswer(message).catch((error) => {
      console.error("Direct JARVIS answer failed:", error);
      return null;
    });
    if (handled) return sseText(handled);

    const hermesResponse = await callHermes(message, history, hermesPromptWithContext);
    if (hermesResponse) return sseFromOpenAIStream(hermesResponse);

    const kimiResponse = await callKimi(message, history, kimiPromptWithContext);
    if (kimiResponse) return sseFromOpenAIStream(kimiResponse);

    return sseText("Je n'arrive pas à joindre Hermes pour l'instant. Les actions directes comme météo restent disponibles.");
  } catch (err) {
    console.error("JARVIS Hermes route error:", err);
    return sseText("Désolé, une erreur de connexion est survenue côté JARVIS. Réessaie dans quelques secondes.");
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
