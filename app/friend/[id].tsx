import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ExpandedPostModal } from "@/components/posts/expanded-post-modal";
import { YimPost, type Post } from "@/components/posts/yim-post";
import { fetchProfile, profileQueryKey } from "@/hooks/useProfile";
import { fetchUserPosts, userPostsQueryKey } from "@/hooks/useYimFeed";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

/**
 * Friend profile view page.
 * Displays a friend's profile with their posts (read-only view).
 */
export default function FriendProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const friendId = id ?? null;

  const [expandedPost, setExpandedPost] = useState<Post | null>(null);
  const [avatarSignedUrl, setAvatarSignedUrl] = useState<string | null>(null);

  // Fetch friend's profile
  const profileQ = useQuery({
    queryKey: friendId ? profileQueryKey(friendId) : ["profile", "disabled"],
    queryFn: () => fetchProfile(friendId as string),
    enabled: !!friendId,
  });

  const profile = profileQ.data ?? null;

  // Fetch friend's posts
  const postsQ = useQuery({
    queryKey: friendId ? userPostsQueryKey(friendId) : ["userPosts", "disabled"],
    queryFn: () => fetchUserPosts(friendId as string),
    enabled: !!friendId,
  });

  const posts = postsQ.data ?? [];
  const recentPosts = useMemo(() => posts.slice(0, 6), [posts]);

  // Fetch avatar signed URL (24h) when profile avatar path changes.
  useEffect(() => {
    const avatarPath = profile?.avatar_url ?? null;
    if (!avatarPath) {
      setAvatarSignedUrl(null);
      return;
    }
    const avatarPathStr = avatarPath;

    let cancelled = false;

    async function fetchAvatarUrl() {
      try {
        const { data, error } = await supabase.storage
          .from("profile-pictures")
          .createSignedUrl(avatarPathStr, 24 * 60 * 60);

        if (cancelled) return;

        if (error || !data?.signedUrl) {
          console.warn("[friend-profile] createSignedUrl failed", { error });
          setAvatarSignedUrl(null);
          return;
        }

        setAvatarSignedUrl(data.signedUrl);
      } catch (error) {
        console.error("[friend-profile] fetch avatar url failed", error);
        if (!cancelled) setAvatarSignedUrl(null);
      }
    }

    void fetchAvatarUrl();
    return () => {
      cancelled = true;
    };
  }, [profile?.avatar_url]);

  const yimCount = posts.length;

  if (!friendId) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <Text className="font-mono text-sm text-destructive">Invalid friend ID</Text>
          <Pressable onPress={() => router.back()} className="mt-4 rounded-xl border border-muted bg-card px-4 py-2">
            <Text className="font-mono text-xs uppercase tracking-wider text-foreground">Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ExpandedPostModal
        isVisible={!!expandedPost}
        post={expandedPost}
        onClose={() => setExpandedPost(null)}
        onUpdated={() => void postsQ.refetch()}
      />

      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-6 pb-24">
        {/* Header */}
        <View className="relative items-center justify-center">
          <Text className="font-display text-4xl text-foreground">Profile</Text>

          <View className="absolute right-0">
            <Pressable onPress={() => router.back()} className="rounded-xl border border-muted bg-card px-4 py-2" accessibilityRole="button">
              <Text className="font-mono text-xs uppercase tracking-wider text-foreground">Back</Text>
            </Pressable>
          </View>
        </View>

        {profileQ.error ? (
          <Text className="mt-3 font-mono text-xs text-destructive">
            {profileQ.error instanceof Error ? profileQ.error.message : "Failed to load profile"}
          </Text>
        ) : null}
        {postsQ.error ? (
          <Text className="mt-3 font-mono text-xs text-destructive">
            {postsQ.error instanceof Error ? postsQ.error.message : "Failed to load posts"}
          </Text>
        ) : null}

        {/* User block */}
        <View className="mt-8 flex-row items-center gap-4">
          <View className="h-20 w-20 overflow-hidden rounded-full border-2 border-primary/30 bg-secondary">
            {avatarSignedUrl ? (
              <Image source={{ uri: avatarSignedUrl }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Text className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">No Photo</Text>
              </View>
            )}
          </View>

          <View className="flex-1">
            <Text className="font-display text-2xl text-foreground">{profile?.first_name ?? profile?.username ?? "Friend"}</Text>
            <Text className="font-mono text-sm text-muted-foreground">
              @{profile?.username ?? friendId.slice(-8)}
            </Text>
            {profileQ.isLoading ? (
              <View className="mt-2">
                <ActivityIndicator />
              </View>
            ) : null}
          </View>
        </View>

        {/* Stats */}
        <View className="mt-8 flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-muted bg-card p-4">
            <Text className="font-display text-3xl text-primary">{yimCount}</Text>
            <Text className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">PONDERs</Text>
          </View>
        </View>

        {/* Recent posts */}
        <View className="mt-10">
          <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Recent PONDERs</Text>

          {postsQ.isLoading ? (
            <View className="mt-6 items-center justify-center">
              <Text className="font-mono text-sm text-muted-foreground">Loading…</Text>
            </View>
          ) : recentPosts.length === 0 ? (
            <View className="mt-6 items-center justify-center">
              <Text className="font-mono text-sm text-muted-foreground">No posts yet</Text>
            </View>
          ) : (
            <View className="mt-4 flex-row flex-wrap">
              {recentPosts.map((p, idx) => (
                <View key={p.id} className={["w-1/2", idx % 2 === 0 ? "pr-2" : "pl-2"].join(" ")}>
                  <View className="mb-4">
                    <YimPost post={p} size="sm" previewMode hideFooter onPress={() => setExpandedPost(p)} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
