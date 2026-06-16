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
        if (data && !data.full_name && user.user_metadata?.full_name) {
          data.full_name = user.user_metadata.full_name;
        }
        if (data && !data.notion_name && user.user_metadata?.full_name) {
          data.notion_name = user.user_metadata.full_name;
        }
        setProfile(data);
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
            if (data && !data.full_name && nextUser.user_metadata?.full_name) {
              data.full_name = nextUser.user_metadata.full_name;
            }
            if (data && !data.notion_name && nextUser.user_metadata?.full_name) {
              data.notion_name = nextUser.user_metadata.full_name;
            }
            setProfile(data);
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
