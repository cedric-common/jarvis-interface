import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  description?: string;
  hangoutLink?: string;
  attendees?: Array<{ email: string; responseStatus?: string }>;
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    console.error("Google refresh token error:", await res.text());
    return null;
  }

  const data = await res.json();
  return data.access_token;
}

async function listEvents(accessToken: string): Promise<CalendarEvent[]> {
  const now = new Date().toISOString();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", now);
  url.searchParams.set("timeMax", tomorrow);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "10");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    console.error("Calendar error:", await res.text());
    return [];
  }

  const data = await res.json();
  return (data.items || []).map((item: any) => ({
    id: item.id,
    summary: item.summary || "(Sans titre)",
    start: item.start,
    end: item.end,
    location: item.location,
    description: item.description,
    hangoutLink: item.hangoutLink,
    attendees: item.attendees,
  }));
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Try profile tokens first (stored from auth/callback)
  const { data: profile } = await supabase
    .from("profiles")
    .select("google_refresh_token, google_access_token")
    .eq("id", user.id)
    .single();

  let effectiveAccessToken: string | null = profile?.google_access_token || (session as any)?.provider_token || null;
  const refreshToken = profile?.google_refresh_token || (session as any)?.provider_refresh_token;

  if (!effectiveAccessToken && refreshToken) {
    effectiveAccessToken = await refreshAccessToken(refreshToken);
    // Update access token in DB if refreshed
    if (effectiveAccessToken) {
      await supabase.from("profiles").update({ google_access_token: effectiveAccessToken }).eq("id", user.id);
    }
  }

  if (!effectiveAccessToken) {
    return NextResponse.json(
      { error: "Google Calendar non connecté. Reconnecte-toi avec Google pour autoriser l'accès Calendrier." },
      { status: 400 }
    );
  }

  const events = await listEvents(effectiveAccessToken);

  return NextResponse.json({
    count: events.length,
    events: events.map((e) => ({
      id: e.id,
      summary: e.summary,
      start: e.start.dateTime || e.start.date,
      end: e.end.dateTime || e.end.date,
      isAllDay: !!e.start.date,
      location: e.location,
      hangoutLink: e.hangoutLink,
      attendeeCount: e.attendees?.length ?? 0,
    })),
  });
}
