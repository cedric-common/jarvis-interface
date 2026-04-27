export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

const responses: Record<string, { response: string; type: string }> = {
  bonjour: {
    response: "Bonjour Cédric ! Je suis prêt à vous aider.",
    type: "text",
  },
  salut: {
    response: "Salut ! Qu'est-ce qu'on fait aujourd'hui ?",
    type: "text",
  },
  vps: {
    response:
      "Vous avez 4 VPS actifs :\n\n• hermes.common.team (187.127.68.111) — Online\n• KVM-2 (72.62.39.157) — Online\n• KVM-2 (187.124.117.162) — Online\n• KVM-1 (76.13.38.176) — Stopped (expire le 3 mai)",
    type: "text",
  },
  serveur: {
    response:
      "Vous avez 4 VPS actifs :\n\n• hermes.common.team (187.127.68.111) — Online\n• KVM-2 (72.62.39.157) — Online\n• KVM-2 (187.124.117.162) — Online\n• KVM-1 (76.13.38.176) — Stopped (expire le 3 mai)",
    type: "text",
  },
  sites: {
    response:
      "109 sites hébergés sur votre Cloud Pro. Les principaux :\n\n• common.team\n• summitly.fr\n• mih-planner.fr\n• hostinger-test.comm-on.fr",
    type: "text",
  },
  web: {
    response:
      "109 sites hébergés sur votre Cloud Pro. Les principaux :\n\n• common.team\n• summitly.fr\n• mih-planner.fr\n• hostinger-test.comm-on.fr",
    type: "text",
  },
  tâches: {
    response:
      "Voici vos 3 tâches prioritaires :\n\n1. 🔴 Finaliser le devis Summitly\n2. 🟡 Relancer le photographe Dupont\n3. 🟢 Préparer la réunion équipe vendredi",
    type: "text",
  },
  todo: {
    response:
      "Voici vos 3 tâches prioritaires :\n\n1. 🔴 Finaliser le devis Summitly\n2. 🟡 Relancer le photographe Dupont\n3. 🟢 Préparer la réunion équipe vendredi",
    type: "text",
  },
  déploie: {
    response:
      "🚀 Déploiement lancé sur Vercel !\n\n• Branche : main\n• Commit : a1b2c3d\n• Statut : Building...\n\nJe vous tiens informé dès que c'est en ligne.",
    type: "action",
  },
  déployer: {
    response:
      "🚀 Déploiement lancé sur Vercel !\n\n• Branche : main\n• Commit : a1b2c3d\n• Statut : Building...\n\nJe vous tiens informé dès que c'est en ligne.",
    type: "action",
  },
  commit: {
    response:
      "🚀 Déploiement lancé sur Vercel !\n\n• Branche : main\n• Commit : a1b2c3d\n• Statut : Building...\n\nJe vous tiens informé dès que c'est en ligne.",
    type: "action",
  },
  hermes: {
    response:
      "📊 Serveur hermes.common.team\n\n• CPU : 12%\n• RAM : 4.2 / 8 GB\n• Disk : 45% utilisé\n• Uptime : 14 jours\n• Load avg : 0.34\n\nTout va bien ✅",
    type: "text",
  },
  statut: {
    response:
      "📊 Serveur hermes.common.team\n\n• CPU : 12%\n• RAM : 4.2 / 8 GB\n• Disk : 45% utilisé\n• Uptime : 14 jours\n• Load avg : 0.34\n\nTout va bien ✅",
    type: "text",
  },
  status: {
    response:
      "📊 Serveur hermes.common.team\n\n• CPU : 12%\n• RAM : 4.2 / 8 GB\n• Disk : 45% utilisé\n• Uptime : 14 jours\n• Load avg : 0.34\n\nTout va bien ✅",
    type: "text",
  },
  météo: {
    response:
      "Je ne peux pas consulter la météo depuis cette interface pour le moment. Demandez-moi directement dans Telegram !",
    type: "text",
  },
  temps: {
    response:
      "Je ne peux pas consulter la météo depuis cette interface pour le moment. Demandez-moi directement dans Telegram !",
    type: "text",
  },
  aide: {
    response:
      "Je peux vous aider avec :\n\n• Infrastructure (VPS, DNS, sites)\n• Déploiements Vercel\n• Gestion des tâches Notion\n• Génération de contenu\n• Recherche et analyses\n\nParlez-moi ou utilisez les raccourcis en bas.",
    type: "text",
  },
  help: {
    response:
      "Je peux vous aider avec :\n\n• Infrastructure (VPS, DNS, sites)\n• Déploiements Vercel\n• Gestion des tâches Notion\n• Génération de contenu\n• Recherche et analyses\n\nParlez-moi ou utilisez les raccourcis en bas.",
    type: "text",
  },
  faire: {
    response:
      "Je peux vous aider avec :\n\n• Infrastructure (VPS, DNS, sites)\n• Déploiements Vercel\n• Gestion des tâches Notion\n• Génération de contenu\n• Recherche et analyses\n\nParlez-moi ou utilisez les raccourcis en bas.",
    type: "text",
  },
};

function getResponse(message: string): { response: string; type: string } {
  const lower = message.toLowerCase();

  for (const [keyword, data] of Object.entries(responses)) {
    if (lower.includes(keyword)) {
      return data;
    }
  }

  return {
    response:
      "Je n'ai pas compris votre demande. Essayez les raccourcis en bas ou reformulez. Vous pouvez me demander : VPS, sites, tâches, déploiement, statut, aide...",
    type: "text",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message requis" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Simulate processing delay
    await new Promise((resolve) =>
      setTimeout(resolve, 300 + Math.random() * 500)
    );

    const result = getResponse(message);

    return new Response(
      JSON.stringify({
        response: result.response,
        type: result.type,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
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
