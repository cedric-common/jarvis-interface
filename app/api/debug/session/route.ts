import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();

  return NextResponse.json({
    hasSession: !!session,
    userId: user?.id,
    userEmail: user?.email,
    provider: user?.app_metadata?.provider,
    sessionKeys: session ? Object.keys(session) : [],
    hasProviderToken: !!(session as any)?.provider_token,
    hasProviderRefreshToken: !!(session as any)?.provider_refresh_token,
    providerTokenPrefix: (session as any)?.provider_token ? ((session as any).provider_token as string).substring(0, 20) + "..." : null,
  });
}
