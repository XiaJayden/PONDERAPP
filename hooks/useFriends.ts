import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

/**
 * Friends system (native).
 *
 * Data model:
 * - `friendships`: stores accepted relationships
 * - `friend_invitations`: token-based invites
 *
 * NOTE on token generation:
 * - Web used `crypto.randomUUID()`. In Expo, `globalThis.crypto` exists on web, but can be missing on native.
 * - We provide a safe fallback token generator for native to avoid adding new deps.
 */

export interface FriendProfile {
  id: string;
  username: string | null;
  first_name: string | null;
  avatar_url: string | null; // storage path
}

export interface FriendInvitation {
  id: string;
  inviter_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  used_by_id: string | null;
  created_at: string;
}

function makeToken() {
  // Prefer UUID when available.
  const maybeCrypto = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  if (maybeCrypto?.randomUUID) return maybeCrypto.randomUUID();

  // Fallback: reasonably unique token for MVP (server still validates + stores).
  // Not cryptographically perfect, but avoids blocking development without extra deps.
  const rand = Math.random().toString(36).slice(2);
  return `t_${Date.now()}_${rand}`;
}

export function useFriends() {
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setFriends([]);
        return;
      }

      const { data: friendships, error: friendshipsError } = await supabase
        .from("friendships")
        .select("user_id, friend_id, status")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq("status", "accepted");

      if (friendshipsError) throw friendshipsError;

      const friendIds =
        friendships?.map((f) => (f.user_id === user.id ? f.friend_id : f.user_id)).filter(Boolean) ?? [];

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .in("id", friendIds);

      if (profilesError) throw profilesError;

      setFriends((profiles ?? []) as FriendProfile[]);
    } catch (error) {
      console.error("[useFriends] refetch failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to load friends");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return useMemo(() => ({ friends, isLoading, errorMessage, refetch }), [friends, isLoading, errorMessage, refetch]);
}

export async function createFriendInvitation() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("[createFriendInvitation] Must be authenticated");

  const token = makeToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data, error } = await supabase
    .from("friend_invitations")
    .insert({
      inviter_id: user.id,
      token,
      expires_at: expiresAt.toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return { token, invitation: data as FriendInvitation };
}

export async function getMyInvitations() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [] as FriendInvitation[];

  const { data, error } = await supabase
    .from("friend_invitations")
    .select("*")
    .eq("inviter_id", user.id)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getMyInvitations] failed", error);
    return [];
  }

  return (data ?? []) as FriendInvitation[];
}

export async function getFriendInvitation(token: string) {
  const { data, error } = await supabase.from("friend_invitations").select("*").eq("token", token).single();
  if (error || !data) return null;

  if (new Date(data.expires_at) < new Date()) return null;
  if (data.used_at) return null;

  return data as FriendInvitation;
}

export async function acceptFriendInvitation(token: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("[acceptFriendInvitation] Must be authenticated");

  const invitation = await getFriendInvitation(token);
  if (!invitation) throw new Error("Invalid or expired invitation token.");

  if (invitation.inviter_id === user.id) throw new Error("You cannot accept your own invitation.");

  // Check if already friends (either direction).
  const { data: existing } = await supabase
    .from("friendships")
    .select("id")
    .or(
      `and(user_id.eq.${invitation.inviter_id},friend_id.eq.${user.id}),and(user_id.eq.${user.id},friend_id.eq.${invitation.inviter_id})`
    )
    .eq("status", "accepted")
    .maybeSingle();

  if (existing) throw new Error("You are already friends with this user.");

  // Create friendship row. (See web notes about RLS; one row is enough for bidirectional querying.)
  const { error: friendshipError } = await supabase.from("friendships").insert({
    user_id: user.id,
    friend_id: invitation.inviter_id,
    status: "accepted",
  });
  if (friendshipError) throw friendshipError;

  // Mark invitation used (best effort).
  const { error: markError } = await supabase
    .from("friend_invitations")
    .update({ used_at: new Date().toISOString(), used_by_id: user.id })
    .eq("id", invitation.id);

  if (markError) console.warn("[acceptFriendInvitation] failed to mark used", markError);
}

export async function deleteFriendship(friendId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("[deleteFriendship] Must be authenticated");

  // Delete both directions (safe even if only one exists).
  const { error: e1 } = await supabase.from("friendships").delete().eq("user_id", user.id).eq("friend_id", friendId);
  const { error: e2 } = await supabase.from("friendships").delete().eq("user_id", friendId).eq("friend_id", user.id);

  const error = e1 || e2;
  if (error) throw error;
}




