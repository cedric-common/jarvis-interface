import { NextRequest, NextResponse } from "next/server";

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = "2025-09-03";
const CLIENTS_DB_ID = "33eeecec-3c85-809a-b862-ce10368a73e9";

export async function GET(req: NextRequest) {
  if (!NOTION_API_KEY) {
    return NextResponse.json({ error: "Notion API key not configured" }, { status: 500 });
  }

  try {
    // Try both endpoints for querying
    const endpoints = [
      `https://api.notion.com/v1/data_sources/${CLIENTS_DB_ID}/query`,
      `https://api.notion.com/v1/databases/${CLIENTS_DB_ID}/query`,
    ];

    let lastError = "";
    let data: any = null;

    for (const url of endpoints) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ page_size: 100 }),
      });

      if (res.ok) {
        data = await res.json();
        break;
      } else {
        lastError = await res.text();
        console.error(`Notion clients error (${url}):`, lastError);
      }
    }

    if (!data) {
      return NextResponse.json(
        { error: `Notion error: ${lastError}`, hint: "Vérifiez que l'intégration JARVIS est partagée avec la base Clients Comm'On" },
        { status: 500 }
      );
    }

    const pages = data.results || [];

    const clients = pages
      .map((page: any) => {
        const props = page.properties || {};
        const titleProp =
          props["Nom"] ||
          props["Name"] ||
          props["Client"] ||
          Object.values(props).find((p: any) => p?.type === "title");

        const name = (titleProp?.title || [])
          .map((t: any) => t.plain_text || t.text?.content || "")
          .join("")
          .trim();

        return { id: page.id, name: name || "Sans nom" };
      })
      .filter((c: any) => c.name && c.name !== "Sans nom")
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({ clients, rawCount: pages.length });
  } catch (err) {
    console.error("Notion clients error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
