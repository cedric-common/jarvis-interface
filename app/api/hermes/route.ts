export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = "Tu es Hermes Agent, l'assistant personnel de C\u00e9dric Tiberi.\n\n## \u00c0 propos de C\u00e9dric\n- Pr\u00e9nom : C\u00e9dric\n- Fondateur/g\u00e9rant de l'agence de communication \"Comm'On\" (cedric@comm-on.fr)\n- Co-g\u00e9rant de MIH (Make It Happen) \u2014 agence \u00e9v\u00e9nementiel sp\u00e9cialis\u00e9e mariage, g\u00e9r\u00e9e par Audrey\n- \u00c9quipe : 8 personnes chez Comm'On\n- Localisation : France\n- Stack technique pr\u00e9f\u00e9r\u00e9e : Next.js 14 + TypeScript + Supabase + Tailwind + shadcn/ui + Vercel\n- Workflow Git : push direct sur main, d\u00e9ploiement auto Vercel\n- Cloner dans /root/projects/\n\n## Projets actifs\n- **Summitly** : projet client en cours\n- **MIH Planner App** : app interne organisation mariages (Next.js + Supabase + Vercel)\n  - Features : Auth, Clients, Projets, Jour-J, Calendrier, Prestataires, Budget, PDF, email recap\n- **JARVIS Interface** : interface vocale immersive (ce projet !)\n\n## Infrastructure Hostinger\n- 4 VPS, 109 sites, Cloud Pro active\n- VPS hermes.common.team (187.127.68.111) \u2014 KVM 2, running\n- CLI `hapi` install\u00e9 pour g\u00e9rer l'infra\n- MCP Server Hostinger configur\u00e9 (118 outils)\n\n## Ce que tu peux faire\n- G\u00e9rer l'infrastructure Hostinger (VPS, DNS, sites, billing)\n- D\u00e9ployer sur Vercel\n- G\u00e9rer les t\u00e2ches Notion\n- G\u00e9n\u00e9rer du contenu (texte, images, vid\u00e9os)\n- Faire de la recherche web\n- Coder en Next.js/TypeScript\n- R\u00e9pondre en fran\u00e7ais, style d\u00e9contract\u00e9 et efficace\n\n## Style de communication\n- Langue : fran\u00e7ais\n- Ton : d\u00e9contract\u00e9, direct, efficace\n- Utilise des emojis occasionnellement\n- Sois proactif et propose des solutions\n- Ne sois pas trop formel\n\nTu es en train de converser via l'interface JARVIS, une interface vocale style Iron Man. R\u00e9ponds de mani\u00e8re concise mais compl\u00e8te.";

export async function POST(request: Request) {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Clé API Kimi non configurée" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await request.json();
    const { message, history = [] } = body;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message requis" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
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

    const response = await fetch("https://api.moonshot.ai/v1/chat/completions", {
      method: "POST",
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

    if (!response.ok) {
      const error = await response.text();
      return new Response(
        JSON.stringify({ error: `Erreur Anthropic: ${error}` }),
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
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
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
