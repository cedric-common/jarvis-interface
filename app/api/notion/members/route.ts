import { NextRequest, NextResponse } from "next/server";

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = "2025-09-03";
const DEFAULT_DB_ID = "10eeecec-3c85-81f0-a8e4-000bd4f3ce6d";

export async function GET(req: NextRequest) {
  if (!NOTION_API_KEY) {
    return NextResponse.json({ error: "Notion API key not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const databaseId = searchParams.get("databaseId") || DEFAULT_DB_ID;

  try {
    // 1. Try to list all workspace users first
    const usersRes = await fetch("https://api.notion.com/v1/users?page_size=100", {
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
      },
    });

    if (usersRes.ok) {
      const usersData = await usersRes.json();
      const people = (usersData.results || [])
        .filter((u: any) => u.type === "person" && u.name)
        .map((u: any) => ({ id: u.id, name: u.name }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

      if (people.length > 0) {
        return NextResponse.json({ members: people });
      }
    }

    // 2. Fallback: extract people from existing pages in the database
    const res = await fetch(`https://api.notion.com/v1/data_sources/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 100 }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Notion error: ${text}` }, { status: 500 });
    }

    const data = await res.json();
    const pages = data.results || [];

    const seen = new Map<string, { id: string; name: string }>();

    for (const page of pages) {
      const props = page.properties || {};
      for (const key of Object.keys(props)) {
        const prop = props[key];
        if (prop?.type === "people" && Array.isArray(prop.people)) {
          for (const person of prop.people) {
            if (person?.id && person?.name) {
              seen.set(person.id, { id: person.id, name: person.name });
            }
          }
        }
      }
    }

    const members = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ members });
  } catch (err) {
    console.error("Notion members error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
