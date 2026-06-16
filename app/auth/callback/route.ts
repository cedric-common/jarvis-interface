import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth", request.url));
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !session) {
    return NextResponse.redirect(new URL("/login?error=auth", request.url));
  }

  // Capture Google tokens for Gmail integration
  const refreshToken = (session as any).provider_refresh_token;
  const accessToken = (session as any).provider_token;
  const fullName = session.user.user_metadata?.full_name;
  const avatarUrl = session.user.user_metadata?.avatar_url;
  
  console.log("[auth/callback] provider_refresh_token present:", !!refreshToken);
  console.log("[auth/callback] provider_token present:", !!accessToken);
  console.log("[auth/callback] full_name:", fullName);
  
  const updateData: any = { updated_at: new Date().toISOString() };
  if (refreshToken) updateData.google_refresh_token = refreshToken;
  if (accessToken) updateData.google_access_token = accessToken;
  if (fullName) {
    updateData.full_name = fullName;
    // Also set notion_name if empty so Notion filtering works
    const { data: existing } = await supabase
      .from("profiles")
      .select("notion_name")
      .eq("id", session.user.id)
      .single();
    if (!existing?.notion_name) {
      updateData.notion_name = fullName;
    }
  }
  if (avatarUrl) updateData.avatar_url = avatarUrl;
  
  if (Object.keys(updateData).length > 1) { // >1 because updated_at is always there
    const { error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", session.user.id);
    
    if (updateError) {
      console.error("[auth/callback] Failed to update profile:", updateError.message);
    } else {
      console.log("[auth/callback] Profile updated for user:", session.user.id);
    }
  } else {
    console.log("[auth/callback] Nothing to update for profile");
  }

  return NextResponse.redirect(new URL("/", request.url));
}
