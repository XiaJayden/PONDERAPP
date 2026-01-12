import { Bookmark, Heart, MessageCircle, MoreHorizontal } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { ActionSheetIOS, Alert, Image, Platform, Pressable, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import type { Post } from "@/components/posts/yim-post";
import { useAuth } from "@/providers/auth-provider";
import { supabase } from "@/lib/supabase";
import { useEventTracking } from "@/hooks/useEventTracking";
import { savedPostsQueryKey } from "@/hooks/useSavedPosts";

function showReportMenu(params: { onReport: () => void }) {
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Report post", "Cancel"],
        cancelButtonIndex: 1,
        destructiveButtonIndex: 0,
        userInterfaceStyle: "dark",
      },
      (buttonIndex) => {
        if (buttonIndex === 0) params.onReport();
      }
    );
    return;
  }

  Alert.alert("Post options", undefined, [
    { text: "Report post", style: "destructive", onPress: params.onReport },
    { text: "Cancel", style: "cancel" },
  ]);
}

export function PostHeader({ post }: { post: Post }) {
  const label = useMemo(() => {
    if (post.authorUsername) return post.authorUsername;
    if (post.authorLabel) return post.authorLabel;
    if (post.authorId) return `Friend ${post.authorId.slice(-4)}`;
    return "Friend";
  }, [post.authorId, post.authorLabel, post.authorUsername]);

  return (
    <View className="mb-3 flex-row items-center justify-between">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 overflow-hidden rounded-full bg-secondary">
          {post.authorAvatarUrl ? (
            <Image source={{ uri: post.authorAvatarUrl }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Text className="font-mono text-[10px] text-muted-foreground">
                {label.slice(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View className="justify-center">
          <Text className="font-body text-lg leading-5 text-foreground">{label}</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Post options"
        onPress={() =>
          showReportMenu({
            onReport: () => {
              if (__DEV__) console.log("[post] report", { postId: post.id, authorId: post.authorId });
              Alert.alert("Reported", "Thanks — we’ll review this post.");
            },
          })
        }
        className="h-10 w-10 items-center justify-center"
      >
        <MoreHorizontal color="hsl(60 9% 98%)" size={20} />
      </Pressable>
    </View>
  );
}

export function PostFooterActions({ post, onCommentPress }: { post: Post; onCommentPress?: () => void }) {
  const { user } = useAuth();
  const { trackEvent } = useEventTracking();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isToggling, setIsToggling] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  // Fetch initial like status and count
  useEffect(() => {
    if (!user || !post.id) return;

    async function fetchLikeStatus() {
      try {
        // Check if current user liked this post
        const { data: userLike } = await supabase
          .from("post_likes")
          .select("id")
          .eq("post_id", post.id)
          .eq("user_id", user.id)
          .maybeSingle();

        setIsLiked(!!userLike);

        // Get total like count
        const { count } = await supabase
          .from("post_likes")
          .select("id", { count: "exact", head: true })
          .eq("post_id", post.id);

        setLikeCount(count ?? 0);
      } catch (error) {
        console.warn("[PostFooterActions] fetchLikeStatus failed", error);
      }
    }

    void fetchLikeStatus();
  }, [user, post.id]);

  // Fetch initial save status
  useEffect(() => {
    if (!user || !post.id) return;

    async function fetchSaveStatus() {
      try {
        const { data } = await supabase
          .from("post_saves")
          .select("id")
          .eq("post_id", post.id)
          .eq("user_id", user.id)
          .maybeSingle();

        setIsSaved(!!data);
      } catch (error) {
        console.warn("[PostFooterActions] fetchSaveStatus failed", error);
      }
    }

    void fetchSaveStatus();
  }, [user, post.id]);

  // Fetch comment count
  useEffect(() => {
    if (!post.id) return;

    async function fetchCommentCount() {
      try {
        const { count } = await supabase
          .from("post_comments")
          .select("id", { count: "exact", head: true })
          .eq("post_id", post.id);

        setCommentCount(count ?? 0);
      } catch (error) {
        console.warn("[PostFooterActions] fetchCommentCount failed", error);
      }
    }

    void fetchCommentCount();
  }, [post.id]);

  async function handleLikeToggle() {
    if (!user || !post.id || isToggling) return;

    setIsToggling(true);
    try {
      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", user.id);

        if (error) throw error;

        setIsLiked(false);
        setLikeCount((prev) => Math.max(0, prev - 1));

        await trackEvent({
          event_type: "button_press",
          event_name: "unlike_post",
          metadata: { post_id: post.id },
        });
      } else {
        // Like
        const { error } = await supabase.from("post_likes").insert({
          post_id: post.id,
          user_id: user.id,
        });

        if (error) throw error;

        setIsLiked(true);
        setLikeCount((prev) => prev + 1);

        await trackEvent({
          event_type: "button_press",
          event_name: "like_post",
          metadata: { post_id: post.id },
        });
      }
    } catch (error) {
      console.warn("[PostFooterActions] handleLikeToggle failed", error);
    } finally {
      setIsToggling(false);
    }
  }

  async function handleSaveToggle() {
    if (!user || !post.id || isSaving) return;

    setIsSaving(true);
    try {
      if (isSaved) {
        // Unsave
        const { error } = await supabase
          .from("post_saves")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", user.id);

        if (error) throw error;

        setIsSaved(false);

        // Immediately refetch saved posts to update gallery
        await queryClient.refetchQueries({ queryKey: savedPostsQueryKey(user.id) });

        await trackEvent({
          event_type: "button_press",
          event_name: "unsave_post",
          metadata: { post_id: post.id },
        });
      } else {
        // Save
        const { error } = await supabase.from("post_saves").insert({
          post_id: post.id,
          user_id: user.id,
        });

        if (error) throw error;

        setIsSaved(true);

        // Immediately refetch saved posts to update gallery
        await queryClient.refetchQueries({ queryKey: savedPostsQueryKey(user.id) });

        await trackEvent({
          event_type: "button_press",
          event_name: "save_post",
          metadata: { post_id: post.id },
        });
      }
    } catch (error) {
      console.warn("[PostFooterActions] handleSaveToggle failed", error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View className="mt-3 flex-row items-center justify-start gap-6 pl-6">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isLiked ? "Unlike" : "Like"}
        onPress={handleLikeToggle}
        disabled={!user || isToggling}
        className="py-2"
      >
        <View className="flex-row items-center gap-2">
          <Heart color={isLiked ? "hsl(0 84% 60%)" : "hsl(60 9% 98%)"} size={22} fill={isLiked ? "hsl(0 84% 60%)" : "none"} />
          {likeCount > 0 && (
            <Text className="font-mono text-xs text-muted-foreground">{likeCount}</Text>
          )}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Comment"
        onPress={onCommentPress}
        className="py-2"
      >
        <View className="flex-row items-center gap-2">
          <MessageCircle color="hsl(60 9% 98%)" size={22} />
          {commentCount > 0 && (
            <Text className="font-mono text-xs text-muted-foreground">{commentCount}</Text>
          )}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isSaved ? "Unsave" : "Save"}
        onPress={handleSaveToggle}
        disabled={!user || isSaving}
        className="py-2"
      >
        <Bookmark
          color={isSaved ? "hsl(82 85% 55%)" : "hsl(60 9% 98%)"}
          size={22}
          fill={isSaved ? "hsl(82 85% 55%)" : "none"}
        />
      </Pressable>
    </View>
  );
}


