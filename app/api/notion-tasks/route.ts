import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = "2025-09-03";
const PARIS_TIME_ZONE = "Europe/Paris";

type Bucket = "overdue" | "today" | "upcoming" | "unscheduled";

interface NotionPerson {
  id?: string;
  name?: string | null;
}

interface NotionProperty {
  type?: string;
  title?: Array<{ plain_text?: string; text?: { content?: string } }>;
  rich_text?: Array<{ plain_text?: string; text?: { content?: string } }>;
  select?: { name?: string | null } | null;
  status?: { name?: string | null } | null;
  date?: { start?: string | null; end?: string | null; time_zone?: string | null } | null;
  people?: NotionPerson[];
  checkbox?: boolean;
  relation?: Array<{ id: string }>;
}

interface NotionPage {
  id: string;
  url?: string;
  properties?: Record<string, NotionProperty>;
}

interface NotionTask {
  id: string;
  title: string;
  client: string;
  status: string;
  priority: string;
  dueDate: string | null;
  bucket: Bucket;
  source: string;
  url?: string;
}

interface Profile {
  notion_name?: string | null;
  role?: string | null;
  full_name?: string | null;
}

const databases: Array<{
  id: string;
  source: string;
  dateProp: string;
  assigneeProps: string[];
  doneProps: string[];
  archiveProps: string[];
}> = [
  {
    id: "10eeecec-3c85-81f0-a8e4-000bd4f3ce6d",
    source: "Tâches Globales",
    dateProp: "Date de publication",
    assigneeProps: ["Responsable", "Assigné"],
    doneProps: [],
    archiveProps: ["Archiver"],
  },
  {
    id: "c024dc03-cacb-4453-a893-631b6f3d43bc",
    source: "Tâches de l'équipe",
    dateProp: "Date d'échéance",
    assigneeProps: ["Assigné", "Responsable"],
    doneProps: ["Done"],
    archiveProps: [],
  },
];

function parisDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return date.toISOString().slice(0, 10);
}

function textFromProperty(prop?: NotionProperty) {
  const chunks = prop?.title ?? prop?.rich_text ?? [];
  return chunks.map((t) => t.plain_text || t.text?.content || "").join("").trim();
}

function optionName(prop?: NotionProperty) {
  return (prop?.status?.name || prop?.select?.name || "").trim();
}

function titleFromProps(props: Record<string, NotionProperty>) {
  const preferred = props["Tâche"] || props["Name"] || props["Titre"];
  if (preferred) return textFromProperty(preferred) || "Sans nom";

  for (const prop of Object.values(props)) {
    if (prop.type === "title") return textFromProperty(prop) || "Sans nom";
  }
  return "Sans nom";
}

function dateStart(prop?: NotionProperty) {
  return prop?.date?.start?.slice(0, 10) || null;
}

function clientFromProps(props: Record<string, NotionProperty>, fallback: string) {
  return optionName(props["Client"]) || textFromProperty(props["Client"]) || fallback;
}

function peopleFromProps(props: Record<string, NotionProperty>, names: string[]) {
  return names.flatMap((name) => props[name]?.people ?? []);
}

function isUserTask(props: Record<string, NotionProperty>, assigneeProps: string[], notionName: string) {
  const people = peopleFromProps(props, assigneeProps);
  if (!people.length) return false;

  const target = notionName.toLowerCase().trim();
  if (!target) return false;

  return people.some((person) => {
    const name = (person.name || "").toLowerCase();
    return name.includes(target);
  });
}

function isDone(props: Record<string, NotionProperty>, doneProps: string[]) {
  if (doneProps.some((name) => props[name]?.checkbox === true)) return true;

  const status = optionName(props["Statut"]).toLowerCase();
  return status === "complété";
}

function isArchived(props: Record<string, NotionProperty>, archiveProps: string[]) {
  return archiveProps.some((name) => props[name]?.checkbox === true);
}

function bucketForDate(dueDate: string | null, today: string): Bucket {
  if (!dueDate) return "unscheduled";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  return "upcoming";
}

function priorityScore(task: NotionTask) {
  const priority = task.priority.toLowerCase();
  const status = task.status.toLowerCase();
  if (task.bucket === "overdue") return 0;
  if (priority.includes("urgent") || priority.includes("haute") || status.includes("urgent")) return 1;
  if (task.bucket === "today") return 2;
  if (priority.includes("moyenne")) return 3;
  return 4;
}

async function queryDatabase(
  dbId: string,
  dateProp: string,
  startDate: string,
  endDate: string,
  headers: Record<string, string>,
  includeUnscheduled: boolean
) {
  const pages: NotionPage[] = [];
  let start_cursor: string | undefined;

  do {
    const res = await fetch(`https://api.notion.com/v1/data_sources/${dbId}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        page_size: 100,
        start_cursor,
        filter: includeUnscheduled
          ? {
              or: [
                {
                  and: [
                    { property: dateProp, date: { on_or_after: startDate } },
                    { property: dateProp, date: { on_or_before: endDate } },
                  ],
                },
                { property: dateProp, date: { is_empty: true } },
              ],
            }
          : {
              and: [
                { property: dateProp, date: { on_or_after: startDate } },
                { property: dateProp, date: { on_or_before: endDate } },
              ],
            },
        sorts: [{ property: dateProp, direction: "ascending" }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Notion DB ${dbId} ${res.status}: ${text}`);
    }

    const data = await res.json();
    pages.push(...(data.results || []));
    start_cursor = data.has_more ? data.next_cursor : undefined;
  } while (start_cursor);

  return pages;
}

export async function GET(req: NextRequest) {
  if (!NOTION_API_KEY) {
    return NextResponse.json({ error: "Notion API key not configured" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("notion_name, role, full_name")
    .eq("id", user.id)
    .single<Profile>();

  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(Number(searchParams.get("days") || 7), 1), 30);
  const includeUnscheduled = searchParams.get("includeUnscheduled") === "1";
  const viewAllParam = searchParams.get("view") === "all";
  const isAdmin = profile?.role === "admin" || user.email === "cedric@agencecommon.com";
  const notionName = profile?.notion_name || profile?.full_name || (user.email === "cedric@agencecommon.com" ? "Cédric" : user.email) || "";
  const viewAll = viewAllParam; // admin voit tout seulement si ?view=all explicitement

  const today = parisDateString();
  const startDate = addDays(today, -30);
  const endDate = addDays(today, days);
  const tasks: NotionTask[] = [];
  const errors: string[] = [];
  const debug: Record<string, unknown> = {
    notionName,
    isAdmin,
    viewAll,
    startDate,
    endDate,
    today,
    databases: [] as Array<{source: string; rawCount: number; afterUserFilter: number; afterArchive: number; afterDone: number; afterBucket: number; error?: string}>,
  };

  const headers = {
    Authorization: `Bearer ${NOTION_API_KEY}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };

  for (const db of databases) {
    let rawCount = 0;
    let afterUserFilter = 0;
    let afterArchive = 0;
    let afterDone = 0;
    let afterBucket = 0;
    let error: string | undefined;

    try {
      const pages = await queryDatabase(db.id, db.dateProp, startDate, endDate, headers, includeUnscheduled);
      rawCount = pages.length;

      for (const page of pages) {
        const props = page.properties || {};
        if (!viewAll || !isAdmin) {
          if (!isUserTask(props, db.assigneeProps, notionName)) continue;
        }
        afterUserFilter++;

        if (isArchived(props, db.archiveProps)) continue;
        afterArchive++;

        if (isDone(props, db.doneProps)) continue;
        afterDone++;

        const dueDate = dateStart(props[db.dateProp]);
        const bucket = bucketForDate(dueDate, today);
        if (bucket === "unscheduled" && !includeUnscheduled) continue;
        if (bucket === "upcoming" && dueDate && dueDate > endDate) continue;
        afterBucket++;

        tasks.push({
          id: page.id,
          title: titleFromProps(props),
          client: clientFromProps(props, db.source),
          status: optionName(props["Statut"]),
          priority: optionName(props["Priorité"]),
          dueDate,
          bucket,
          source: db.source,
          url: page.url,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(msg);
      errors.push(`${db.source}: ${msg}`);
      error = msg;
    }

    (debug.databases as Array<unknown>).push({
      source: db.source,
      rawCount,
      afterUserFilter,
      afterArchive,
      afterDone,
      afterBucket,
      error,
    });
  }

  tasks.sort((a, b) => {
    const score = priorityScore(a) - priorityScore(b);
    if (score !== 0) return score;
    return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
  });

  const summary = {
    total: tasks.length,
    overdue: tasks.filter((task) => task.bucket === "overdue").length,
    today: tasks.filter((task) => task.bucket === "today").length,
    upcoming: tasks.filter((task) => task.bucket === "upcoming").length,
    urgent: tasks.filter((task) => {
      const combined = `${task.status} ${task.priority}`.toLowerCase();
      return combined.includes("urgent") || combined.includes("haute");
    }).length,
  };

  return NextResponse.json({ tasks, summary, date: today, horizonDays: days, errors, debug });
}
