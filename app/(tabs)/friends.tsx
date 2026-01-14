import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createFriendInvitation,
  deleteFriendship,
  getMyInvitations,
  useFriends,
  type FriendInvitation,
} from "@/hooks/useFriends";
import { useAuth } from "@/providers/auth-provider";
import * as Linking from "expo-linking";

export default function FriendsScreen() {
  const { user } = useAuth();
  const { friends, isLoading, errorMessage, refetch } = useFriends();

  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [activeInvites, setActiveInvites] = useState<FriendInvitation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canUseFriends = !!user;

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    async function loadInvites() {
      const invites = await getMyInvitations();
      if (cancelled) return;
      setActiveInvites(invites);
      if (invites[0]?.token) setInviteUrl(Linking.createURL(`/invite/${invites[0].token}`));
    }
    void loadInvites();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const title = useMemo(() => (inviteUrl ? "Share Invitation Link" : "Generate Invitation Link"), [inviteUrl]);

  async function handleGenerateInvite() {
    if (!user) return;
    if (isGenerating) return;

    setIsGenerating(true);
    setActionError(null);
    try {
      const { token } = await createFriendInvitation();
      const url = Linking.createURL(`/invite/${token}`);
      setInviteUrl(url);
      const invites = await getMyInvitations();
      setActiveInvites(invites);
    } catch (error) {
      console.error("[friends] generate invite failed", error);
      setActionError(error instanceof Error ? error.message : "Failed to generate invite.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleShareInvite() {
    if (!inviteUrl) {
      await handleGenerateInvite();
      return;
    }

    try {
      await Share.share({
        title: "Join me on PONDER",
        message: `I'm capturing moments with words on PONDER. Join me!\n\n${inviteUrl}`,
      });
    } catch (error) {
      console.warn("[friends] share cancelled/failed", error);
    }
  }

  async function handleDeleteFriend(friendId: string) {
    setActionError(null);
    try {
      await deleteFriendship(friendId);
      await refetch();
    } catch (error) {
      console.error("[friends] delete failed", error);
      setActionError(error instanceof Error ? error.message : "Failed to remove friend.");
    }
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 pt-6" contentContainerClassName="pb-24">
        <View className="relative items-center justify-center">
          <Text className="font-display text-4xl text-foreground">Friends</Text>
          {!canUseFriends ? (
            <View className="absolute right-0">
              <Pressable onPress={() => router.replace("/(auth)/login")} className="rounded-xl border border-muted bg-card px-4 py-2">
                <Text className="font-mono text-xs uppercase tracking-wider text-foreground">Login</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {!!errorMessage ? <Text className="mt-2 font-mono text-xs text-destructive">{errorMessage}</Text> : null}
        {!!actionError ? <Text className="mt-2 font-mono text-xs text-destructive">{actionError}</Text> : null}

        {/* Invite */}
        <View className="mt-6 gap-3">
          <Pressable
            onPress={() => void handleShareInvite()}
            disabled={!canUseFriends || isGenerating}
            className="w-full flex-row items-center justify-between rounded-2xl border border-primary/30 bg-card px-4 py-4"
            accessibilityRole="button"
          >
            <View className="gap-1">
              <Text className="font-mono text-sm text-foreground">{title}</Text>
              <Text className="font-mono text-xs text-muted-foreground">Share via text, airdrop, socials…</Text>
            </View>
            {isGenerating ? <ActivityIndicator /> : <Text className="font-mono text-xs text-primary">Share</Text>}
          </Pressable>

          {inviteUrl ? (
            <View className="rounded-2xl border border-muted bg-card p-4">
              <Text className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Invitation link</Text>
              <Text className="mt-2 font-mono text-xs text-foreground">{inviteUrl}</Text>
              {activeInvites[0]?.expires_at ? (
                <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
                  Expires: {new Date(activeInvites[0].expires_at).toLocaleDateString()}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Friend list */}
        <View className="mt-8 gap-3">
          <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Your friends ({friends.length})</Text>

          {isLoading ? (
            <View className="py-6">
              <ActivityIndicator />
            </View>
          ) : friends.length === 0 ? (
            <Text className="font-mono text-sm text-muted-foreground">No friends yet.</Text>
          ) : (
            friends.map((f) => (
              <View key={f.id} className="flex-row items-center justify-between rounded-2xl border border-muted bg-card px-4 py-3">
                <View className="flex-1">
                  <Text className="font-body text-base text-foreground">{f.first_name ?? f.username ?? "Friend"}</Text>
                  {!!f.username ? <Text className="font-mono text-xs text-muted-foreground">@{f.username}</Text> : null}
                </View>

                <Pressable onPress={() => void handleDeleteFriend(f.id)} accessibilityRole="button" className="px-2 py-2">
                  <Text className="font-mono text-xs text-muted-foreground">Remove</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


