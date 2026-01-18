import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  checkFriendsResponseStatus,
  createFriendInvitation,
  deleteFriendship,
  getMyInvitations,
  useFriends,
  type FriendInvitation,
} from "@/hooks/useFriends";
import { useDailyPrompt } from "@/hooks/useDailyPrompt";
import { useAuth } from "@/providers/auth-provider";
import * as Linking from "expo-linking";

export default function FriendsScreen() {
  const { user } = useAuth();
  const { friends, isLoading, errorMessage, refetch } = useFriends();
  const { prompt } = useDailyPrompt();

  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [activeInvites, setActiveInvites] = useState<FriendInvitation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [respondedFriendIds, setRespondedFriendIds] = useState<Set<string>>(new Set());
  const [isCheckingResponses, setIsCheckingResponses] = useState(false);
  const [menuOpenFriendId, setMenuOpenFriendId] = useState<string | null>(null);

  const canUseFriends = !!user;

  // Check which friends have responded to today's prompt
  useEffect(() => {
    if (!prompt || !prompt.id || friends.length === 0) {
      setRespondedFriendIds(new Set());
      return;
    }

    const promptId = prompt.id; // Capture promptId outside async function for TypeScript
    let cancelled = false;
    async function checkResponses() {
      setIsCheckingResponses(true);
      try {
        const friendIds = friends.map((f) => f.id);
        const responded = await checkFriendsResponseStatus({
          friendIds,
          promptId,
        });
        if (!cancelled) {
          setRespondedFriendIds(responded);
        }
      } catch (error) {
        console.error("[friends] check responses failed", error);
      } finally {
        if (!cancelled) {
          setIsCheckingResponses(false);
        }
      }
    }

    void checkResponses();
    return () => {
      cancelled = true;
    };
  }, [prompt?.id, friends]);

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
    setMenuOpenFriendId(null);
    try {
      await deleteFriendship(friendId);
      await refetch();
    } catch (error) {
      console.error("[friends] delete failed", error);
      setActionError(error instanceof Error ? error.message : "Failed to remove friend.");
    }
  }

  function handleShowMenu(friendId: string) {
    setMenuOpenFriendId(friendId);
  }

  function handleCloseMenu() {
    setMenuOpenFriendId(null);
  }

  function handleNudge(friendName: string) {
    Alert.alert("Nudge", "Nudge feature in development");
  }

  // Split friends into responded and waiting
  const { respondedFriends, waitingFriends } = useMemo(() => {
    const responded: typeof friends = [];
    const waiting: typeof friends = [];

    friends.forEach((friend) => {
      if (respondedFriendIds.has(friend.id)) {
        responded.push(friend);
      } else {
        waiting.push(friend);
      }
    });

    return { respondedFriends: responded, waitingFriends: waiting };
  }, [friends, respondedFriendIds]);

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

          {isLoading || isCheckingResponses ? (
            <View className="py-6">
              <ActivityIndicator />
            </View>
          ) : friends.length === 0 ? (
            <Text className="font-mono text-sm text-muted-foreground">No friends yet.</Text>
          ) : (
            <>
              {/* Waiting section */}
              {waitingFriends.length > 0 ? (
                <View className="gap-3">
                  <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Waiting ({waitingFriends.length})
                  </Text>
                  {waitingFriends.map((f) => (
                    <FriendCard
                      key={f.id}
                      friend={f}
                      onPress={() => router.push(`/friend/${f.id}`)}
                      onMenuPress={() => handleShowMenu(f.id)}
                      onNudge={() => handleNudge(f.first_name ?? f.username ?? "Friend")}
                      showNudge={true}
                      menuOpen={menuOpenFriendId === f.id}
                      onCloseMenu={handleCloseMenu}
                      onDelete={() => void handleDeleteFriend(f.id)}
                    />
                  ))}
                </View>
              ) : null}

              {/* Responded section */}
              {respondedFriends.length > 0 ? (
                <View className="gap-3">
                  <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Responded ({respondedFriends.length})
                  </Text>
                  {respondedFriends.map((f) => (
                    <FriendCard
                      key={f.id}
                      friend={f}
                      onPress={() => router.push(`/friend/${f.id}`)}
                      onMenuPress={() => handleShowMenu(f.id)}
                      onNudge={() => handleNudge(f.first_name ?? f.username ?? "Friend")}
                      showNudge={false}
                      menuOpen={menuOpenFriendId === f.id}
                      onCloseMenu={handleCloseMenu}
                      onDelete={() => void handleDeleteFriend(f.id)}
                    />
                  ))}
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface FriendCardProps {
  friend: { id: string; username: string | null; first_name: string | null };
  onPress: () => void;
  onMenuPress: () => void;
  onNudge: () => void;
  showNudge: boolean;
  menuOpen: boolean;
  onCloseMenu: () => void;
  onDelete: () => void;
}

function FriendCard({ friend, onPress, onMenuPress, onNudge, showNudge, menuOpen, onCloseMenu, onDelete }: FriendCardProps) {
  function handleMenuPress() {
    if (menuOpen) {
      onCloseMenu();
    } else {
      onMenuPress();
    }
  }

  function handleDeletePress() {
    Alert.alert("Remove Friend", `Are you sure you want to remove ${friend.first_name ?? friend.username ?? "this friend"}?`, [
      { text: "Cancel", style: "cancel", onPress: onCloseMenu },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          onDelete();
        },
      },
    ]);
  }

  return (
    <View className="rounded-2xl border border-muted bg-card">
      <Pressable onPress={onPress} className="flex-row items-center justify-between px-4 py-3" accessibilityRole="button">
        <View className="flex-1">
          <Text className="font-body text-base text-foreground">{friend.first_name ?? friend.username ?? "Friend"}</Text>
          {!!friend.username ? <Text className="font-mono text-xs text-muted-foreground">@{friend.username}</Text> : null}
        </View>

        <View className="flex-row items-center gap-2">
          {showNudge ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onNudge();
              }}
              accessibilityRole="button"
              className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5"
            >
              <Text className="font-mono text-xs text-primary">Nudge</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handleMenuPress();
            }}
            accessibilityRole="button"
            className="px-2 py-2"
          >
            <Text className="font-mono text-lg text-muted-foreground">⋮</Text>
          </Pressable>
        </View>
      </Pressable>

      {menuOpen ? (
        <View className="border-t border-muted px-4 py-2">
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handleDeletePress();
            }}
            accessibilityRole="button"
            className="py-2"
          >
            <Text className="font-mono text-xs text-destructive">Remove Friend</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}


