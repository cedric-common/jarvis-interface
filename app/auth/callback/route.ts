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
  
  console.log("[auth/callback] provider_refresh_token present:", !!refreshToken);
  console.log("[auth/callback] provider_token present:", !!accessToken);
  
  const updateData: any = { updated_at: new Date().toISOString() };
  if (refreshToken) updateData.google_refresh_token = refreshToken;
  if (accessToken) updateData.google_access_token = accessToken;
  
  if (refreshToken || accessToken) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", session.user.id);
    
    if (updateError) {
      console.error("[auth/callback] Failed to save tokens:", updateError.message);
    } else {
      console.log("[auth/callback] Tokens saved for user:", session.user.id);
    }
  } else {
    console.log("[auth/callback] No Google tokens in session");
  }

  return NextResponse.redirect(new URL("/", request.url));
}
