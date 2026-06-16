import { NextRequest, NextResponse } from "next/server";

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = "2025-09-03";

export async function GET(req: NextRequest) {
  if (!NOTION_API_KEY) {
    return NextResponse.json({ error: "Notion API key not configured" }, { status: 500 });
  }

  try {
    // Step 1: Search for the database by name
    const searchRes = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "Clients Comm",
        filter: { value: "database", property: "object" },
        page_size: 10,
      }),
    });

    if (!searchRes.ok) {
      const text = await searchRes.text();
      return NextResponse.json({ error: `Notion search error: ${text}` }, { status: 500 });
    }

    const searchData = await searchRes.json();
    const databases = (searchData.results || []).filter((r: any) => r.object === "database");

    if (databases.length === 0) {
      return NextResponse.json(
        { error: "Base 'Clients Comm'On' non trouvée", hint: "Vérifiez le nom ou partagez la base avec l'intégration JARVIS" },
        { status: 404 }
      );
    }

    const db = databases[0];
    const dbId = db.id;

    // Step 2: Query the database
    const endpoints = [
      `https://api.notion.com/v1/data_sources/${dbId}/query`,
      `https://api.notion.com/v1/databases/${dbId}/query`,
    ];

    let data: any = null;
    let lastError = "";

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
      }
    }

    if (!data) {
      return NextResponse.json(
        { error: `Notion query error: ${lastError}`, dbId },
        { status: 500 }
      );
    }

    const pages = data.results || [];

    // Debug: show property types from first result
    const firstPageProps = pages[0]?.properties || {};
    const propTypes = Object.entries(firstPageProps).map(([k, v]: [string, any]) => ({
      name: k,
      type: v?.type,
      sample: v?.title ? (v.title[0]?.plain_text || v.title[0]?.text?.content) : undefined,
    }));

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

    return NextResponse.json({ clients, rawCount: pages.length, propTypes, dbName: db.title?.[0]?.plain_text || db.title?.[0]?.text?.content });
  } catch (err) {
    console.error("Notion clients error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
