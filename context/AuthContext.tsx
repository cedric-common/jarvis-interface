"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/profile";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  isLoading: true,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("id, email, full_name, role, notion_name, avatar_url, created_at, updated_at")
          .eq("id", user.id)
          .single();
        // Fallback to Google metadata if profile fields are empty
        const googleName = user.user_metadata?.full_name || user.user_metadata?.name;
        if (data && !data.full_name && googleName) {
          data.full_name = googleName;
        }
        if (data && !data.notion_name && googleName) {
          data.notion_name = googleName;
        }
        // If no profile row exists at all, create a minimal one from Google metadata
        if (!data && googleName) {
          const minimalProfile: Profile = {
            id: user.id,
            email: user.email || "",
            full_name: googleName,
            role: "cm",
            notion_name: googleName,
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setProfile(minimalProfile);
          // Also insert it into DB so next time it's there
          supabase.from("profiles").insert(minimalProfile).then(({ error }) => {
            if (error) console.error("[AuthContext] Failed to insert profile:", error.message);
          });
        } else {
          setProfile(data);
        }
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    };

    fetchUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((
      _event: string,
      session: { user: User | null } | null
    ) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        supabase
          .from("profiles")
          .select("id, email, full_name, role, notion_name, avatar_url, created_at, updated_at")
          .eq("id", nextUser.id)
          .single()
          .then(({ data }: { data: Profile | null }) => {
            // Fallback to Google metadata if profile fields are empty
            const googleName = nextUser.user_metadata?.full_name || nextUser.user_metadata?.name;
            if (data && !data.full_name && googleName) {
              data.full_name = googleName;
            }
            if (data && !data.notion_name && googleName) {
              data.notion_name = googleName;
            }
            // If no profile row exists at all, create a minimal one from Google metadata
            if (!data && googleName) {
              const minimalProfile: Profile = {
                id: nextUser.id,
                email: nextUser.email || "",
                full_name: googleName,
                role: "cm",
                notion_name: googleName,
                avatar_url: nextUser.user_metadata?.avatar_url || nextUser.user_metadata?.picture || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              setProfile(minimalProfile);
              supabase.from("profiles").insert(minimalProfile).then(({ error }) => {
                if (error) console.error("[AuthContext] Failed to insert profile:", error.message);
              });
            } else {
              setProfile(data);
            }
          });
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, isLoading, isAdmin: profile?.role === "admin" }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
