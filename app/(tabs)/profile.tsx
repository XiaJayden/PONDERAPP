import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ExpandedPostModal } from "@/components/posts/expanded-post-modal";
import { YimPost, type Post } from "@/components/posts/yim-post";
import { DailyFeedback } from "@/components/feedback/daily-feedback";
import { useFriends } from "@/hooks/useFriends";
import { useProfile } from "@/hooks/useProfile";
import { useUserPosts } from "@/hooks/useYimFeed";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";

export default function ProfileScreen() {
  const { signOut, user } = useAuth();
  const { profile, isLoading: isProfileLoading, errorMessage: profileError, upsertProfile, refetch: refetchProfile } =
    useProfile();
  const { friends } = useFriends();
  const userPosts = useUserPosts();

  const [expandedPost, setExpandedPost] = useState<Post | null>(null);
  const [avatarSignedUrl, setAvatarSignedUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const friendCount = friends.length;
  const yimCount = userPosts.posts.length;

  const recentPosts = useMemo(() => userPosts.posts.slice(0, 6), [userPosts.posts]);

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
          console.warn("[profile] createSignedUrl failed", { error });
          setAvatarSignedUrl(null);
          return;
        }

        setAvatarSignedUrl(data.signedUrl);
      } catch (error) {
        console.error("[profile] fetch avatar url failed", error);
        if (!cancelled) setAvatarSignedUrl(null);
      }
    }

    void fetchAvatarUrl();
    return () => {
      cancelled = true;
    };
  }, [profile?.avatar_url]);

  async function handlePickAvatar() {
    if (!user) return;
    if (isUploadingAvatar) return;

    setIsUploadingAvatar(true);
    setActionError(null);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;

      // Upload to Supabase Storage.
      const path = `${user.id}/${Date.now()}.jpg`;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error } = await supabase.storage.from("profile-pictures").upload(path, arrayBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

      if (error) throw error;

      if (__DEV__) console.log("[profile] avatar uploaded", { path });

      await upsertProfile({ avatar_url: path });
      await refetchProfile();
    } catch (error) {
      console.error("[profile] avatar upload failed", error);
      setActionError(error instanceof Error ? error.message : "Failed to upload avatar.");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ExpandedPostModal
        isVisible={!!expandedPost}
        post={expandedPost}
        onClose={() => setExpandedPost(null)}
        onUpdated={() => void userPosts.refetch()}
      />

      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-6 pb-24">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-3xl text-foreground">Profile</Text>

          <Pressable
            onPress={() => void signOut()}
            className="rounded-xl border border-muted bg-card px-4 py-2"
            accessibilityRole="button"
          >
            <Text className="font-mono text-xs uppercase tracking-wider text-foreground">Sign out</Text>
          </Pressable>
        </View>

        {!!profileError ? <Text className="mt-3 font-mono text-xs text-destructive">{profileError}</Text> : null}
        {!!actionError ? <Text className="mt-3 font-mono text-xs text-destructive">{actionError}</Text> : null}

        {/* User block */}
        <View className="mt-8 flex-row items-center gap-4">
          <Pressable
            onPress={() => void handlePickAvatar()}
            disabled={isUploadingAvatar}
            accessibilityRole="button"
            className="h-20 w-20 overflow-hidden rounded-full border-2 border-primary/30 bg-secondary"
          >
            {avatarSignedUrl ? (
              <Image source={{ uri: avatarSignedUrl }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Text className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {isUploadingAvatar ? "Uploading…" : "Edit"}
                </Text>
              </View>
            )}
          </Pressable>

          <View className="flex-1">
            <Text className="font-display text-2xl text-foreground">
              {profile?.first_name ?? profile?.username ?? "User"}
            </Text>
            <Text className="font-mono text-sm text-muted-foreground">
              @{profile?.username ?? user?.email?.split("@")[0] ?? "user"}
            </Text>
            {isProfileLoading ? (
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
          <View className="flex-1 rounded-2xl border border-muted bg-card p-4">
            <Text className="font-display text-3xl text-foreground">{friendCount}</Text>
            <Text className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Friends</Text>
          </View>
        </View>

        {/* Recent posts */}
        <View className="mt-10">
          <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Recent PONDRs</Text>

          {userPosts.isLoading ? (
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

          {!!userPosts.errorMessage ? (
            <Text className="mt-3 font-mono text-xs text-destructive">{userPosts.errorMessage}</Text>
          ) : null}
        </View>

        {/* Alpha feedback */}
        <View className="mt-10">
          <DailyFeedback />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


