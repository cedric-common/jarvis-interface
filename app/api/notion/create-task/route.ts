import { NextRequest, NextResponse } from "next/server";

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = "2025-09-03";

// Default database: Tâches Globales
const DEFAULT_DB_ID = "10eeecec-3c85-81f0-a8e4-000bd4f3ce6d";

interface CreateTaskBody {
  title: string;
  date?: string; // YYYY-MM-DD
  assignee?: string; // notion person name (legacy)
  assigneeId?: string; // notion person id (preferred)
  clientId?: string; // notion client page id
  databaseId?: string;
  status?: string;
  priority?: string;
}

export async function POST(req: NextRequest) {
  if (!NOTION_API_KEY) {
    return NextResponse.json({ error: "Notion API key not configured" }, { status: 500 });
  }

  try {
    const body: CreateTaskBody = await req.json();
    const { title, date, assignee, assigneeId, clientId, databaseId = DEFAULT_DB_ID, status, priority } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Titre requis" }, { status: 400 });
    }

    const properties: Record<string, any> = {
      Tâche: { title: [{ text: { content: title } }] },
    };

    // Add date if provided
    if (date) {
      properties["Date de publication"] = { date: { start: date } };
    }

    // Add status if provided
    if (status) {
      properties["Statut"] = { status: { name: status } };
    }

    // Add priority if provided
    if (priority) {
      properties["Priorité"] = { select: { name: priority } };
    }

    // Add assignee if provided — use ID directly if given, otherwise search by name
    if (assigneeId) {
      properties["Responsable"] = { people: [{ id: assigneeId }] };
    } else if (assignee) {
      // Try to find the person in the database
      const peopleRes = await fetch(`https://api.notion.com/v1/data_sources/${databaseId}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ page_size: 1 }),
      });

      if (peopleRes.ok) {
        const dbData = await peopleRes.json();
        // Extract people from any people property in results
        const peopleProps = Object.keys(dbData.results?.[0]?.properties || {}).filter(
          (key) => dbData.results[0].properties[key].type === "people"
        );

        for (const propName of peopleProps) {
          const propData = dbData.results[0].properties[propName];
          const people = propData.people || [];
          const matched = people.find((p: any) =>
            p.name?.toLowerCase().includes(assignee.toLowerCase())
          );
          if (matched) {
            properties[propName] = { people: [{ id: matched.id }] };
            break;
          }
        }
      }
    }

    // Add client if provided — try relation first, then select fallback
    if (clientId) {
      properties["Client"] = { relation: [{ id: clientId }] };
    }

    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Notion create task error:", err);
      return NextResponse.json({ error: `Notion error: ${err}` }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({
      success: true,
      id: data.id,
      url: data.url,
      title,
    });
  } catch (err) {
    console.error("Create task error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
