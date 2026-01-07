import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  birthday: string | null; // YYYY-MM-DD
  avatar_url: string | null; // Storage path
  onboarding_complete: boolean;
}

export function useProfile() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, first_name, birthday, avatar_url, onboarding_complete")
        .eq("id", user.id)
        .single();

      if (error) {
        // Missing profile is expected for brand-new accounts.
        if (error.code === "PGRST116") {
          if (__DEV__) console.log("[useProfile] No profile yet (needs onboarding)");
          setProfile(null);
          setErrorMessage(null);
          return;
        }

        console.error("[useProfile] fetch failed", error);
        setErrorMessage(error.message);
        return;
      }

      setProfile(data);
      setErrorMessage(null);
    } catch (err) {
      console.error("[useProfile] fetch exception", err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to fetch profile");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const checkUsernameAvailability = useCallback(async (username: string) => {
    const normalized = username.trim().toLowerCase();
    if (!normalized) return false;

    const { data, error } = await supabase.from("profiles").select("id").eq("username", normalized).maybeSingle();
    if (error) {
      console.error("[useProfile] checkUsernameAvailability failed", error);
      throw error;
    }

    return !data;
  }, []);

  const upsertProfile = useCallback(
    async (updates: Partial<Omit<Profile, "id">>) => {
      if (!user) throw new Error("User not authenticated");

      const payload = {
        id: user.id,
        ...updates,
      };

      if (__DEV__) console.log("[useProfile] upsert", { keys: Object.keys(payload) });

      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) {
        console.error("[useProfile] upsert failed", error);
        throw error;
      }

      await fetchProfile();
    },
    [fetchProfile, user]
  );

  return {
    profile,
    isLoading,
    errorMessage,
    refetch: fetchProfile,
    checkUsernameAvailability,
    upsertProfile,
  };
}


