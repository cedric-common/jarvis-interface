import { NextRequest, NextResponse } from "next/server";

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = "2022-06-28";

interface NotionTask {
  title: string;
  client: string;
  status: string;
  url?: string;
}

export async function GET(req: NextRequest) {
  if (!NOTION_API_KEY) {
    return NextResponse.json(
      { error: "Notion API key not configured" },
      { status: 500 }
    );
  }

  const headers = {
    Authorization: `Bearer ${NOTION_API_KEY}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };

  const today = new Date().toISOString().split("T")[0];
  const tasks: NotionTask[] = [];

  // Database configs: [id, displayName, datePropertyName]
  const databases: [string, string, string][] = [
    ["10eeecec-3c85-8005-9485-eaf04db9f9d7", "Tâches Globales", "Date de publication"],
    ["72f1554f-2420-4b0a-84bd-f1b56d598cf7", "Tâches de l'équipe", "Date d'échéance"],
  ];

  for (const [dbId, dbTitle, dateProp] of databases) {
    try {
      const res = await fetch(
        `https://api.notion.com/v1/databases/${dbId}/query`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            filter: {
              property: dateProp,
              date: { equals: today },
            },
          }),
        }
      );

      if (!res.ok) {
        console.error(`Notion DB ${dbId} error:`, res.status, await res.text());
        continue;
      }

      const data = await res.json();

      for (const page of data.results || []) {
        const props = page.properties || {};

        // Title
        let title = "Sans nom";
        const titleProp = props["Tâche"] || props["Name"] || props["Titre"];
        if (titleProp?.title?.length) {
          title = titleProp.title.map((t: any) => t.plain_text || t.text?.content || "").join("");
        }

        // Client
        let client = dbTitle;
        const clientSelect = props["Client"]?.select;
        if (clientSelect?.name) {
          client = clientSelect.name;
        }

        // Status
        let status = "";
        const statusProp = props["Statut"];
        if (statusProp?.status?.name) {
          status = statusProp.status.name;
        } else if (statusProp?.select?.name) {
          status = statusProp.select.name;
        }

        // Filter: only Cédric's tasks
        let isMine = false;
        const responsable = props["Responsable"]?.people || [];
        const assigne = props["Assigné"]?.people || [];
        const people = responsable.length ? responsable : assigne;

        for (const person of people) {
          const name = (person.name || "").toLowerCase();
          if (name.includes("cédric") || name.includes("cedric")) {
            isMine = true;
            break;
          }
        }

        // If no assignee on team tasks, include anyway
        if (dbTitle === "Tâches de l'équipe" && !people.length) {
          isMine = true;
        }

        if (!isMine) continue;

        // Skip completed
        const doneKeywords = ["complété", "complet", "fait", "done", "terminé", "publié", "validé"];
        if (status && doneKeywords.some((kw) => status.toLowerCase().includes(kw))) {
          continue;
        }

        tasks.push({
          title: title || "Sans nom",
          client,
          status,
          url: page.url,
        });
      }
    } catch (err) {
      console.error(`Notion DB ${dbId} exception:`, err);
    }
  }

  return NextResponse.json({ tasks, date: today });
}
