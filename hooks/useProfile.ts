import { useCallback } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
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

export function profileQueryKey(userId: string) {
  return ["profile", userId] as const;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, first_name, birthday, avatar_url, onboarding_complete")
    .eq("id", userId)
    .single();

  if (error) {
    // Missing profile is expected for brand-new accounts.
    if ((error as any).code === "PGRST116") return null;
    throw error;
  }

  return (data ?? null) as Profile | null;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const q = useQuery({
    queryKey: userId ? profileQueryKey(userId) : ["profile", "anonymous"],
    queryFn: () => fetchProfile(userId as string),
    enabled: !!userId,
  });

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
      if (!userId) throw new Error("User not authenticated");

      const payload = {
        id: userId,
        ...updates,
      };

      if (__DEV__) console.log("[useProfile] upsert", { keys: Object.keys(payload) });

      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) {
        console.error("[useProfile] upsert failed", error);
        throw error;
      }

      await queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
      await q.refetch();
    },
    [q, queryClient, userId]
  );

  return {
    profile: (q.data ?? null) as Profile | null,
    isLoading: q.isLoading,
    errorMessage: q.error instanceof Error ? q.error.message : q.error ? String(q.error) : null,
    refetch: async () => {
      await q.refetch();
    },
    checkUsernameAvailability,
    upsertProfile,
  };
}


