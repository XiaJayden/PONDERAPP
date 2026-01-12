import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Heart, MessageCircle, Bookmark } from "lucide-react-native";

import { useActivity, type ActivityNotification } from "@/hooks/useActivity";
import { ExpandedPostModal } from "@/components/posts/expanded-post-modal";
import { YimPost, type Post } from "@/components/posts/yim-post";
import { supabase } from "@/lib/supabase";
import { mapRowToPost, hydrateSignedUrls, hydrateAuthorInfo, type YimPostRow } from "@/hooks/useYimFeed";
import { RefreshControl } from "react-native";

function formatNotificationTime(createdAt: string): string {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getNotificationIcon(type: "like" | "comment" | "save") {
  switch (type) {
    case "like":
      return <Heart color="hsl(0 84% 60%)" size={20} fill="hsl(0 84% 60%)" />;
    case "comment":
      return <MessageCircle color="hsl(60 9% 98%)" size={20} />;
    case "save":
      return <Bookmark color="hsl(82 85% 55%)" size={20} fill="hsl(82 85% 55%)" />;
  }
}

function getNotificationText(notification: ActivityNotification): string {
  const actor = notification.actor_label ?? "Someone";
  switch (notification.notification_type) {
    case "like":
      return `${actor} liked your post`;
    case "comment":
      return `${actor} commented on your post`;
    case "save":
      return `${actor} saved your post`;
  }
}

function NotificationItem({
  notification,
  onPress,
  onMarkAsRead,
}: {
  notification: ActivityNotification;
  onPress: () => void;
  onMarkAsRead: () => void;
}) {
  const isUnread = !notification.read_at;

  return (
    <Pressable
      onPress={() => {
        onPress();
        if (isUnread) {
          onMarkAsRead();
        }
      }}
      accessibilityRole="button"
      className={[
        "mb-3 flex-row gap-3 rounded-2xl border p-4",
        isUnread ? "border-primary/30 bg-card" : "border-muted bg-card/50",
      ].join(" ")}
    >
      <View className="h-12 w-12 overflow-hidden rounded-full bg-secondary">
        {notification.actor_avatar_url ? (
          <Image
            source={{ uri: notification.actor_avatar_url }}
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="font-mono text-[10px] text-muted-foreground">
              {notification.actor_label?.slice(0, 2).toUpperCase() ?? "?"}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          {getNotificationIcon(notification.notification_type)}
          <Text className="flex-1 font-body text-sm text-foreground">
            {getNotificationText(notification)}
          </Text>
        </View>

        {notification.post_quote && (
          <Text
            numberOfLines={2}
            className="mt-2 font-mono text-xs text-muted-foreground"
            style={{ fontFamily: "SpaceMono" }}
          >
            "{notification.post_quote}"
          </Text>
        )}

        {notification.comment_content && (
          <Text
            numberOfLines={2}
            className="mt-2 font-mono text-xs text-foreground"
            style={{ fontFamily: "SpaceMono" }}
          >
            {notification.comment_content}
          </Text>
        )}

        <Text className="mt-2 font-mono text-[10px] text-muted-foreground">
          {formatNotificationTime(notification.created_at)}
        </Text>
      </View>

      {isUnread && (
        <View className="h-2 w-2 rounded-full bg-primary" style={{ marginTop: 6 }} />
      )}
    </Pressable>
  );
}

export default function ActivityScreen() {
  const { notifications, isLoading, markAsRead, markAllAsRead, unreadCount, refetch } = useActivity();
  const [expandedPost, setExpandedPost] = useState<Post | null>(null);

  // Fetch post details when needed
  async function handleNotificationPress(notification: ActivityNotification) {
    if (!notification.post_id) return;

    try {
      // Fetch the specific post
      const { data: row, error } = await supabase
        .from("yim_posts")
        .select(
          "id, author_id, quote, attribution, background, font, font_color, font_size, text_highlight, photo_background_url, expanded_text, prompt_id, prompt_date, created_at"
        )
        .eq("id", notification.post_id)
        .single();

      if (error) throw error;
      if (!row) return;

      // Hydrate the post (convert to Post type)
      const signedUrlMap = await hydrateSignedUrls([row as YimPostRow]);
      const authorInfoMap = await hydrateAuthorInfo([(row as YimPostRow).author_id]);
      const post = mapRowToPost(row as YimPostRow, signedUrlMap, authorInfoMap);

      setExpandedPost(post);
    } catch (error) {
      console.warn("[ActivityScreen] Failed to fetch post", error);
    }
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ExpandedPostModal
        isVisible={!!expandedPost}
        post={expandedPost}
        onClose={() => setExpandedPost(null)}
        onUpdated={() => {
          // Activity will refresh via the hook
        }}
      />

      <View className="px-4 pt-2">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center"
            hitSlop={10}
          >
            <ChevronLeft color="hsl(60 9% 98%)" size={24} />
          </Pressable>

          <Text className="font-display text-2xl text-foreground">Activity</Text>

          {unreadCount > 0 ? (
            <Pressable
              onPress={() => markAllAsRead()}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
              className="h-10 items-center justify-center px-3"
            >
              <Text className="font-mono text-xs uppercase tracking-wider text-primary">
                Mark all read
              </Text>
            </Pressable>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>

        {isLoading ? (
          <View className="mt-8 items-center justify-center py-10">
            <ActivityIndicator />
            <Text className="mt-2 font-mono text-sm text-muted-foreground">Loading activity…</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View className="mt-8 rounded-2xl border border-muted bg-card p-5">
            <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              No activity yet
            </Text>
            <Text className="mt-3 font-body text-base text-foreground">
              When someone likes, comments on, or saves your posts, you'll see it here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <NotificationItem
                notification={item}
                onPress={() => handleNotificationPress(item)}
                onMarkAsRead={() => markAsRead(item.id)}
              />
            )}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}











