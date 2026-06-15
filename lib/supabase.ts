import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Retourne un mock minimal pour éviter le crash quand Supabase n'est pas configuré
    return null as any;
  }

  return createBrowserClient(url, key);
}
