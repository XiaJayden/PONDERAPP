import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import React, { useState } from "react";
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
import { useActivity } from "@/hooks/useActivity";
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
  const devTools = useDevTools();
  const feed = useYimFeed(devTools.showAllPosts);
  const phase = usePhase(devTools.phaseOverride);
  const { unreadCount } = useActivity();

  const [expandedPost, setExpandedPost] = useState<Post | null>(null);
  const [isPromptPopupVisible, setIsPromptPopupVisible] = useState(false);

  // For posting day: check if user responded to today's prompt
  // For viewing day: use dedicated query to check if user has a post for yesterday
  const hasAnsweredToday = phase.phase === "viewing" 
    ? feed.hasRespondedToViewingDay 
    : dailyPrompt.hasAnsweredToday;

  // On viewing day, we show posts from the previous posting day's prompt
  // Use the same yesterdayDateKey as the feed to ensure consistency
  const viewingDayPromptDate = phase.phase === "viewing" ? feed.yesterdayDateKey : null;

  const viewingDayPromptQ = useQuery({
    queryKey: viewingDayPromptDate ? dailyPromptForDateQueryKey(viewingDayPromptDate) : ["viewingDayPrompt", "disabled"],
    queryFn: () => fetchPromptForDate(viewingDayPromptDate!),
    enabled: !!viewingDayPromptDate,
  });

  const viewingDayPrompt = viewingDayPromptQ.data ?? null;

  // Fallback: if no viewing day prompt, use the daily prompt (current cycle's prompt)
  // This ensures we always show SOME prompt on viewing day
  const displayPrompt = viewingDayPrompt ?? dailyPrompt.prompt;

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

        {/* Prompt Popup - works for both posting and viewing day */}
        {(phase.phase === "posting" ? dailyPrompt.prompt : displayPrompt) ? (
          <PromptPopup
            isVisible={isPromptPopupVisible}
            prompt={(phase.phase === "posting" ? dailyPrompt.prompt : displayPrompt)!}
            onClose={() => setIsPromptPopupVisible(false)}
            onRespond={() => {
              const activePrompt = phase.phase === "posting" ? dailyPrompt.prompt : displayPrompt;
              // For viewing day, use yesterdayDateKey to ensure the post appears in the feed
              // (even if the prompt's own date is different)
              const promptDateToUse = phase.phase === "viewing" ? feed.yesterdayDateKey : activePrompt!.prompt_date;
              
              setIsPromptPopupVisible(false);
              router.replace({
                pathname: "/(tabs)/create",
                params: {
                  promptId: activePrompt!.id,
                  promptText: activePrompt!.prompt_text,
                  promptDate: promptDateToUse,
                },
              });
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
                source={require("../../assets/images/ponder-logo.png")}
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
                {unreadCount > 0 && (
                  <View
                    className="absolute right-0 top-1 h-4 w-4 items-center justify-center rounded-full bg-primary"
                    style={{ marginRight: 2 }}
                  >
                    <Text className="font-mono text-[8px] font-bold text-background">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                )}
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
            <>
              {/* Question Container - clickable like posting day */}
              {displayPrompt ? (
                <Pressable
                  onPress={() => setIsPromptPopupVisible(true)}
                  className="mt-6 rounded-2xl border border-muted bg-card p-5"
                  accessibilityRole="button"
                  accessibilityLabel="Yesterday's prompt"
                >
                  <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Yesterday's PONDER</Text>
                  <Text className="mt-3 font-playfair text-2xl leading-tight text-foreground">
                    {displayPrompt.prompt_text}
                  </Text>

                  {!hasAnsweredToday ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        if (!displayPrompt) {
                          Alert.alert("No prompt available", "There is no prompt to respond to right now.");
                          return;
                        }
                        // Open the prompt popup for viewing day prompt
                        setIsPromptPopupVisible(true);
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
              ) : viewingDayPromptQ.isLoading || dailyPrompt.isLoading ? (
                <View className="mt-6 rounded-2xl border border-muted bg-card p-5">
                  <Text className="font-mono text-sm text-muted-foreground">Loading prompt...</Text>
                </View>
              ) : (
                <View className="mt-6 rounded-2xl border border-muted bg-card p-5">
                  <Text className="font-mono text-sm text-muted-foreground">No prompt available</Text>
                </View>
              )}

              {/* Countdown */}
              <View className="mt-4 items-center">
                <Text className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {formatHms(phase.timeRemaining)} until next prompt
                </Text>
              </View>
            </>
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
                    <PostFooterActions post={post} onCommentPress={() => setExpandedPost(post)} />
                  </View>
                ))
              ) : (
                feed.posts.map((post) => (
                  <View key={post.id} className="w-full">
                    <BlurredPost post={post} />
                    <PostFooterActions post={post} onCommentPress={() => setExpandedPost(post)} />
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
