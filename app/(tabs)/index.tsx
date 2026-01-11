import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { ExpandedPostModal } from "@/components/posts/expanded-post-modal";
import { PostFooterActions, PostHeader } from "@/components/posts/post-chrome";
import { BlurredPost } from "@/components/posts/blurred-post";
import { YimPost, type Post } from "@/components/posts/yim-post";
import { AnsweringStateCountdown } from "@/components/dev/answering-countdown";
import { PromptPopup } from "@/components/prompts/prompt-popup";
import { dailyPromptForDateQueryKey, fetchPromptForDate, useDailyPrompt } from "@/hooks/useDailyPrompt";
import { usePhase } from "@/hooks/usePhase";
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
  const phase = usePhase(devTools.phaseOverride);

  const [expandedPost, setExpandedPost] = useState<Post | null>(null);
  const [isPromptPopupVisible, setIsPromptPopupVisible] = useState(false);

  const hasAnsweredToday = dailyPrompt.hasAnsweredToday;

  // On viewing day, we show posts from the previous posting day's prompt
  const viewingDayPromptDate = useMemo(() => {
    if (phase.phase === "viewing") {
      // Yesterday's date (the posting day that just ended)
      const yesterday = new Date(phase.phaseStartedAt);
      yesterday.setDate(yesterday.getDate() - 1);
      const year = yesterday.getFullYear();
      const month = String(yesterday.getMonth() + 1).padStart(2, "0");
      const day = String(yesterday.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return null;
  }, [phase.phase, phase.phaseStartedAt]);

  const viewingDayPromptQ = useQuery({
    queryKey: viewingDayPromptDate ? dailyPromptForDateQueryKey(viewingDayPromptDate) : ["viewingDayPrompt", "disabled"],
    queryFn: () => fetchPromptForDate(viewingDayPromptDate!),
    enabled: !!viewingDayPromptDate,
  });

  const viewingDayPrompt = viewingDayPromptQ.data ?? null;

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

        {/* Prompt Popup */}
        {dailyPrompt.prompt && phase.phase === "posting" ? (
          <PromptPopup
            isVisible={isPromptPopupVisible}
            prompt={dailyPrompt.prompt}
            onClose={() => setIsPromptPopupVisible(false)}
            onRespond={() => {
              // #region agent log
              console.log('[DEBUG H2] index.tsx PromptPopup onRespond - closing local popup, opening DevTools popup');
              // #endregion
              setIsPromptPopupVisible(false);
              devTools.openPromptPopup();
            }}
          />
        ) : null}

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

          {/* Phase-based UI */}
          {phase.phase === "posting" ? (
            /* POSTING DAY */
            <>
              {/* Question Container */}
              {dailyPrompt.prompt ? (
                <Pressable
                  onPress={() => setIsPromptPopupVisible(true)}
                  className="mt-6 rounded-2xl border border-muted bg-card p-5"
                  accessibilityRole="button"
                  accessibilityLabel="Today's prompt"
                >
                  <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Today's PONDER</Text>
                  <Text className="mt-3 font-playfair text-2xl leading-tight text-foreground">
                    {dailyPrompt.prompt.prompt_text}
                  </Text>

                  {!hasAnsweredToday ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        if (!dailyPrompt.prompt) {
                          Alert.alert("No prompt available", "There is no daily prompt to respond to right now.");
                          return;
                        }
                        devTools.openPromptPopup();
                      }}
                      accessibilityRole="button"
                      className="mt-4 items-center justify-center rounded-xl bg-primary px-4 py-3"
                    >
                      <Text className="font-mono text-xs uppercase tracking-wider text-background">Respond Now</Text>
                    </Pressable>
                  ) : (
                    <View className="mt-4 items-center justify-center rounded-xl bg-muted px-4 py-3">
                      <Text className="font-mono text-xs uppercase tracking-wider text-foreground">You've responded</Text>
                    </View>
                  )}
                </Pressable>
              ) : dailyPrompt.isLoading ? (
                <View className="mt-6 rounded-2xl border border-muted bg-card p-5">
                  <Text className="font-mono text-sm text-muted-foreground">Loading prompt...</Text>
                </View>
              ) : (
                <View className="mt-6 rounded-2xl border border-muted bg-card p-5">
                  <Text className="font-mono text-sm text-muted-foreground">
                    No prompt available for {dailyPrompt.cycleDateKey}
                  </Text>
                </View>
              )}

              {/* Countdown Container */}
              <View className="mt-6">
                <AnsweringStateCountdown timeUntilReleaseMs={phase.timeRemaining} />
              </View>
            </>
          ) : (
            /* VIEWING DAY */
            <View className="mt-6 rounded-2xl border border-muted bg-card p-5">
              {viewingDayPrompt ? (
                <>
                  <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Yesterday's PONDER</Text>
                  <Text className="mt-3 font-playfair text-2xl leading-tight text-foreground">
                    {viewingDayPrompt.prompt_text}
                  </Text>
                </>
              ) : viewingDayPromptQ.isLoading ? (
                <Text className="font-mono text-sm text-muted-foreground">Loading prompt...</Text>
              ) : (
                <Text className="font-mono text-sm text-muted-foreground">No prompt available</Text>
              )}

              <Text className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {formatHms(phase.timeRemaining)} until posting
              </Text>
            </View>
          )}

          {/* Posts - only show on viewing day */}
          {phase.phase === "viewing" ? (
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
          ) : null}
        </ScrollView>
        </View>
      </SafeAreaView>
  );
}
