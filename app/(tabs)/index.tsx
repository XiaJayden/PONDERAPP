import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { ExpandedPostModal } from "@/components/posts/expanded-post-modal";
import { PostFooterActions, PostHeader } from "@/components/posts/post-chrome";
import { BlurredPost } from "@/components/posts/blurred-post";
import { YimPost, type Post } from "@/components/posts/yim-post";
import { dailyPromptForDateQueryKey, fetchPromptForDate, useDailyPrompt } from "@/hooks/useDailyPrompt";
import { useYimFeed } from "@/hooks/useYimFeed";
import { useAuth } from "@/providers/auth-provider";
import { useDevTools } from "@/providers/dev-tools-provider";

function formatHms(ms: number | null) {
  const totalSeconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function FeedScreen() {
  const dailyPrompt = useDailyPrompt();
  const feed = useYimFeed();
  const devTools = useDevTools();

  const [expandedPost, setExpandedPost] = useState<Post | null>(null);

  const hasAnsweredToday = dailyPrompt.hasAnsweredToday;

  const yesterdayPromptQ = useQuery({
    queryKey: dailyPromptForDateQueryKey(feed.yesterdayDateKey),
    queryFn: () => fetchPromptForDate(feed.yesterdayDateKey),
    enabled: !!feed.yesterdayDateKey,
  });

  const yesterdayPrompt = yesterdayPromptQ.data ?? null;

  return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-1">
        {/* Expanded Post */}
        <ExpandedPostModal
          isVisible={!!expandedPost}
          post={expandedPost}
          onClose={() => setExpandedPost(null)}
          onUpdated={() => void feed.refetch(true)}
        />

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-24"
          refreshControl={<RefreshControl refreshing={feed.isRefreshing} onRefresh={() => void feed.refetch()} />}
        >
          {/* Header */}
          <View className="flex-row items-center">
            {/* left spacer to keep logo centered */}
            <View style={{ width: 44 }} />

            <View className="flex-1 items-center">
              <Image
                source={require("../../assets/images/ponder logo.png")}
                accessibilityLabel="PONDER"
                style={{ width: 200, height: 74, resizeMode: "contain", marginBottom: -14 }}
              />
            </View>

            <View style={{ width: 44 }} className="items-end justify-center">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Activity"
                onPress={() => router.push("/activity")}
                className="h-11 w-11 items-center justify-center"
                style={{ marginTop: 12, marginRight: 8 }}
              >
                <Bell color="hsl(60 9% 98%)" size={22} />
              </Pressable>
            </View>
          </View>

          {/* Not Answered CTA */}
          {!hasAnsweredToday ? (
            <View className="mt-6 rounded-2xl border border-muted bg-card p-5">
              <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">To view yesterday’s posts</Text>
              <Text className="mt-3 font-playfair text-2xl leading-tight text-foreground">
                Answer today’s PONDER.
              </Text>

              <Pressable
                onPress={() => {
                  if (!dailyPrompt.prompt) return;
                  devTools.openPromptPopup();
                }}
                accessibilityRole="button"
                className="mt-4 items-center justify-center rounded-xl bg-primary px-4 py-3"
                disabled={!dailyPrompt.prompt || !dailyPrompt.isPromptAvailable || !dailyPrompt.isResponseWindowOpen}
              >
                <Text className="font-mono text-xs uppercase tracking-wider text-background">Respond Now</Text>
              </Pressable>

              <Text className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {formatHms(dailyPrompt.timeUntilCycleEnd)} until 6AM
              </Text>
            </View>
          ) : yesterdayPrompt ? (
            <View className="mt-6 rounded-2xl border border-muted bg-card p-5">
              <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Yesterday’s PONDER</Text>
              <Text className="mt-3 font-playfair text-2xl leading-tight text-foreground">{yesterdayPrompt.prompt_text}</Text>
            </View>
          ) : null}

          {/* Posts */}
          <View className="mt-8 gap-6">
            {feed.isLoading ? (
              <View className="items-center justify-center py-10">
                <Text className="font-mono text-sm text-muted-foreground">Loading posts…</Text>
              </View>
            ) : feed.posts.length === 0 ? (
              <View className="items-center justify-center py-10">
                <Text className="font-mono text-sm text-muted-foreground">No posts yet.</Text>
              </View>
            ) : hasAnsweredToday ? (
              feed.posts.map((post) => (
                <View key={post.id} className="w-full">
                  <PostHeader post={post} />
                  <YimPost post={post} onPress={() => setExpandedPost(post)} />
                  <PostFooterActions />
                </View>
              ))
            ) : (
              feed.posts.map((post) => (
                <View key={post.id} className="w-full">
                  <BlurredPost post={post} />
                  <PostFooterActions />
                </View>
              ))
            )}
          </View>
        </ScrollView>
        </View>
      </SafeAreaView>
  );
}
