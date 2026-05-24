export const dynamic = "force-dynamic";

import { fetchHostinger } from "@/lib/hostinger";

const KIMI_TIMEOUT_MS = 25_000;

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
  const list = Array.isArray(data) ? data : data?.data ?? [];
  if (!Array.isArray(list) || list.length === 0) return "Je n'ai trouvé aucun VPS Hostinger.";
  const lines = list.slice(0, 8).map((vps: any) => {
    const name = vps.hostname || vps.name || `VPS ${vps.id ?? ""}`.trim();
    const ip = vps.ipv4?.[0]?.address || vps.ipv4_address || vps.ip || "IP inconnue";
    const state = vps.state || vps.status || "statut inconnu";
    return `• ${name} — ${ip} — ${state}`;
  });
  return `Tu as ${list.length} VPS Hostinger :\n\n${lines.join("\n")}`;
}

async function getSitesAnswer() {
  const data = await fetchHostinger("/hosting/v1/websites");
  const list = Array.isArray(data) ? data : data?.data ?? [];
  if (!Array.isArray(list) || list.length === 0) return "Je n'ai trouvé aucun site Hostinger.";
  const lines = list.slice(0, 10).map((site: any) => `• ${site.domain || site.name || site.website || "site sans nom"}`);
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

const SYSTEM_PROMPT = "Tu es Hermes Agent, l'assistant personnel de C\u00e9dric Tiberi.\n\n## \u00c0 propos de C\u00e9dric\n- Pr\u00e9nom : C\u00e9dric\n- Fondateur/g\u00e9rant de l'agence de communication \"Comm'On\" (cedric@comm-on.fr)\n- Co-g\u00e9rant de MIH (Make It Happen) \u2014 agence \u00e9v\u00e9nementiel sp\u00e9cialis\u00e9e mariage, g\u00e9r\u00e9e par Audrey\n- \u00c9quipe : 8 personnes chez Comm'On\n- Localisation : France\n- Stack technique pr\u00e9f\u00e9r\u00e9e : Next.js 14 + TypeScript + Supabase + Tailwind + shadcn/ui + Vercel\n- Workflow Git : push direct sur main, d\u00e9ploiement auto Vercel\n- Cloner dans /root/projects/\n\n## Projets actifs\n- **Summitly** : projet client en cours\n- **MIH Planner App** : app interne organisation mariages (Next.js + Supabase + Vercel)\n  - Features : Auth, Clients, Projets, Jour-J, Calendrier, Prestataires, Budget, PDF, email recap\n- **JARVIS Interface** : interface vocale immersive (ce projet !)\n\n## Infrastructure Hostinger\n- 4 VPS, 109 sites, Cloud Pro active\n- VPS hermes.common.team (187.127.68.111) \u2014 KVM 2, running\n- CLI `hapi` install\u00e9 pour g\u00e9rer l'infra\n- MCP Server Hostinger configur\u00e9 (118 outils)\n\n## Ce que tu peux faire\n- G\u00e9rer l'infrastructure Hostinger (VPS, DNS, sites, billing)\n- D\u00e9ployer sur Vercel\n- G\u00e9rer les t\u00e2ches Notion\n- G\u00e9n\u00e9rer du contenu (texte, images, vid\u00e9os)\n- Faire de la recherche web\n- Coder en Next.js/TypeScript\n- R\u00e9pondre en fran\u00e7ais, style d\u00e9contract\u00e9 et efficace\n\n## Style de communication\n- Langue : fran\u00e7ais\n- Ton : d\u00e9contract\u00e9, direct, efficace\n- Utilise des emojis occasionnellement\n- Sois proactif et propose des solutions\n- Ne sois pas trop formel\n\nTu es en train de converser via l'interface JARVIS, une interface vocale style Iron Man. R\u00e9ponds de mani\u00e8re concise mais compl\u00e8te.";

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

    const apiKey = process.env.KIMI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Clé API Kimi non configurée" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build messages array
    const messages = [
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), KIMI_TIMEOUT_MS);

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
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.text();
      return new Response(
        JSON.stringify({ error: `Erreur Kimi: ${error}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Stream the response
    const reader = response.body?.getReader();
    if (!reader) {
      return new Response(
        JSON.stringify({ error: "Pas de réponse du serveur" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  // OpenAI/Kimi format
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    const payload = JSON.stringify({ text: content });
                    controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
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
  } catch (err) {
    console.error("JARVIS Hermes route error:", err);
    if (err instanceof Error && err.name === "AbortError") {
      return sseText("Je n'ai pas reçu de réponse de Kimi assez vite. Réessaie, ou demande-moi une action directe comme météo, VPS, sites ou tâches.");
    }
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
