export const dynamic = "force-dynamic";

import { fetchHostinger } from "@/lib/hostinger";

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

async function getVpsAnswer() {
  const data = await fetchHostinger("/vps/v1/virtual-machines");
  const list = getList(data).filter((vps) => {
    const state = getString(vps.state) || getString(vps.status);
    return state !== "destroyed";
  });
  if (list.length === 0) return "Je n'ai trouvé aucun VPS Hostinger actif dans l'inventaire JARVIS.";
  const inactive = list.filter((vps) => {
    const state = getString(vps.state) || getString(vps.status);
    return state && state !== "running" && state !== "online" && state !== "active";
  });
  const lines = list.slice(0, 8).map((vps) => {
    const ip4 = Array.isArray(vps.ipv4) ? asRecord(vps.ipv4[0]) : {};
    const name = getString(vps.hostname) || getString(vps.name) || `VPS ${getString(vps.id, "")}`.trim();
    const ip = getString(ip4.address) || getString(vps.ipv4_address) || getString(vps.ip) || "IP inconnue";
    const state = getString(vps.state) || getString(vps.status) || "statut inconnu";
    return `• ${name} — ${ip} — ${state}`;
  });
  const warning = inactive.length
    ? `\n\nÀ vérifier : ${inactive.length} VPS non actif. ${inactive.map((vps) => {
        const name = getString(vps.hostname) || `VPS ${getString(vps.id, "")}`.trim();
        const state = getString(vps.state) || getString(vps.status) || "statut inconnu";
        const ip4 = Array.isArray(vps.ipv4) ? asRecord(vps.ipv4[0]) : {};
        const ip = getString(ip4.address) || "aucune IPv4";
        return `${name} est ${state} (${ip})`;
      }).join(" ; ")}. Action conseillée : vérifier avant toute action automatique.`
    : "";
  return `Tu as ${list.length} VPS Hostinger :\n\n${lines.join("\n")}${warning}`;
}

async function getSitesAnswer() {
  const data = await fetchHostinger("/hosting/v1/websites");
  const list = getList(data);
  if (list.length === 0) return "Je n'ai trouvé aucun site Hostinger.";
  const lines = list.slice(0, 10).map((site) => `• ${getString(site.domain) || getString(site.name) || getString(site.website) || "site sans nom"}`);
  return `Tu as ${list.length} sites Hostinger. Les premiers :\n\n${lines.join("\n")}`;
}

async function directAnswer(message: string) {
  const text = message.toLowerCase();
  if (text.includes("météo") || text.includes("meteo") || text.includes("temps") || text.includes("solenzara")) {
    return getWeatherAnswer();
  }
  if (text.includes("vps") || text.includes("serveur")) {
    return getVpsAnswer();
  }
  if (text.includes("site") || text.includes("web")) {
    return getSitesAnswer();
  }
  return null;
}

const KIMI_SYSTEM_PROMPT = "Tu es Hermes Agent, l'assistant personnel de Cédric Tiberi dans l'interface JARVIS. Réponds en français, ton direct et efficace. Si une action réelle est demandée mais que tu n'as pas l'outil, dis-le clairement.";
const HERMES_SYSTEM_PROMPT = "Tu réponds depuis l'interface vocale JARVIS de Cédric. Réponds en français, concis et opérationnel. Utilise tes outils Hermes si nécessaire.";

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

async function callHermes(message: string, history: unknown) {
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
          { role: "system", content: HERMES_SYSTEM_PROMPT },
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

async function callKimi(message: string, history: unknown) {
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
          { role: "system", content: KIMI_SYSTEM_PROMPT },
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
    const body = await request.json();
    const { message, history = [] } = body;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message requis" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const handled = await directAnswer(message).catch((error) => {
      console.error("Direct JARVIS answer failed:", error);
      return null;
    });
    if (handled) return sseText(handled);

    const hermesResponse = await callHermes(message, history);
    if (hermesResponse) return sseFromOpenAIStream(hermesResponse);

    const kimiResponse = await callKimi(message, history);
    if (kimiResponse) return sseFromOpenAIStream(kimiResponse);

    return sseText("Je n'arrive pas à joindre Hermes pour l'instant. Les actions directes comme météo, VPS et sites restent disponibles.");
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
