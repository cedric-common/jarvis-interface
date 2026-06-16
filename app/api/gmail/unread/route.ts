import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured");
    return null;
  }

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
    const err = await res.text();
    console.error("Google refresh token error:", err);
    return null;
  }

  const data = await res.json();
  return data.access_token;
}

async function listUnreadMessages(accessToken: string): Promise<GmailMessage[]> {
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=10",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Gmail list error:", err);
    return [];
  }

  const data = await res.json();
  const messages = data.messages || [];

  const results: GmailMessage[] = [];
  for (const msg of messages) {
    const detailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!detailRes.ok) continue;

    const detail = await detailRes.json();
    const headers = detail.payload?.headers || [];
    const subject = headers.find((h: any) => h.name === "Subject")?.value || "(no subject)";
    const from = headers.find((h: any) => h.name === "From")?.value || "";
    const date = headers.find((h: any) => h.name === "Date")?.value || "";

    results.push({
      id: msg.id,
      subject,
      from,
      snippet: detail.snippet || "",
      date,
    });
  }

  return results;
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const accessToken = (session as any)?.provider_token;
  const refreshToken = (session as any)?.provider_refresh_token;

  if (!accessToken && !refreshToken) {
    return NextResponse.json(
      { error: "Gmail non connecté. Reconnecte-toi avec Google pour autoriser l'accès Gmail." },
      { status: 400 }
    );
  }

  let effectiveAccessToken: string | null = accessToken || null;
  
  if (refreshToken) {
    effectiveAccessToken = await refreshAccessToken(refreshToken);
  }

  if (!effectiveAccessToken) {
    return NextResponse.json(
      { error: "Impossible d'accéder à Gmail. Réautorise l'accès." },
      { status: 500 }
    );
  }

  const messages = await listUnreadMessages(effectiveAccessToken);

  return NextResponse.json({
    count: messages.length,
    messages,
  });
}
