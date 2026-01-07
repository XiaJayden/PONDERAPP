import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ExpandedPostModal } from "@/components/posts/expanded-post-modal";
import { PostFooterActions, PostHeader } from "@/components/posts/post-chrome";
import { YimPost, type Post } from "@/components/posts/yim-post";
import { PostingWindowBanner } from "@/components/prompts/posting-window";
import { PromptCard } from "@/components/prompts/prompt-card";
import { PromptPopup } from "@/components/prompts/prompt-popup";
import { useDailyPrompt } from "@/hooks/useDailyPrompt";
import { useYimFeed } from "@/hooks/useYimFeed";
import { markPromptPopupShown, wasPromptPopupShown } from "@/lib/prompt-store";
import { getTodayPacificIsoDate } from "@/lib/timezone";
import { useAuth } from "@/providers/auth-provider";

export default function FeedScreen() {
  const { user } = useAuth();
  const dailyPrompt = useDailyPrompt();
  const feed = useYimFeed();

  const [showPromptPopup, setShowPromptPopup] = useState(false);
  const [expandedPost, setExpandedPost] = useState<Post | null>(null);

  const todayPacific = useMemo(() => getTodayPacificIsoDate(), []);

  // Auto-show prompt popup once per day when prompt becomes available and user hasn't responded.
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    const ensuredUserId = userId;
    if (dailyPrompt.isLoading) return;
    if (!dailyPrompt.prompt) return;
    if (!dailyPrompt.isPromptAvailable) return;
    if (dailyPrompt.hasResponded) return;

    let cancelled = false;

    async function check() {
      const shown = await wasPromptPopupShown({
        userId: ensuredUserId,
        promptId: dailyPrompt.prompt!.id,
        dateKey: todayPacific,
      });
      if (cancelled) return;
      if (shown) return;
      setShowPromptPopup(true);
      await markPromptPopupShown({ userId: ensuredUserId, promptId: dailyPrompt.prompt!.id, dateKey: todayPacific });
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [dailyPrompt.hasResponded, dailyPrompt.isLoading, dailyPrompt.isPromptAvailable, dailyPrompt.prompt, todayPacific, user]);

  const arePostsVisible = useMemo(() => {
    // Web behavior: before 12:30pm PT, hide posts (but still show prompt card).
    if (!dailyPrompt.prompt) return true;
    return dailyPrompt.timeUntilRelease === null;
  }, [dailyPrompt.prompt, dailyPrompt.timeUntilRelease]);

  const shouldShowPostingBanner = useMemo(() => {
    if (!dailyPrompt.prompt) return false;
    if (dailyPrompt.isInResponseWindow) return true;
    // Also show when counting down to release.
    return dailyPrompt.timeUntilRelease !== null && dailyPrompt.timeUntilRelease > 0;
  }, [dailyPrompt.isInResponseWindow, dailyPrompt.prompt, dailyPrompt.timeUntilRelease]);

  return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <View className="flex-1">
        {/* Prompt Popup */}
        {dailyPrompt.prompt ? (
          <PromptPopup
            isVisible={showPromptPopup}
            prompt={dailyPrompt.prompt}
            onClose={() => setShowPromptPopup(false)}
            onRespond={() => {
              setShowPromptPopup(false);
              void dailyPrompt.markPromptOpened();
              router.replace({
                pathname: "/(tabs)/create",
                params: {
                  promptId: dailyPrompt.prompt!.id,
                  promptText: dailyPrompt.prompt!.prompt_text,
                  promptDate: dailyPrompt.prompt!.prompt_date,
                },
              });
            }}
          />
        ) : null}

        {/* Expanded Post */}
        <ExpandedPostModal
          isVisible={!!expandedPost}
          post={expandedPost}
          onClose={() => setExpandedPost(null)}
          onUpdated={() => void feed.refetch(true)}
        />

        {shouldShowPostingBanner ? (
          <PostingWindowBanner
            isActive={dailyPrompt.isInResponseWindow}
            timeRemainingMs={dailyPrompt.timeUntilDeadline}
            timeUntilReleaseMs={dailyPrompt.timeUntilRelease}
            isResponseWindowOpen={dailyPrompt.isResponseWindowOpen}
          />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerClassName={["px-4 pb-24", shouldShowPostingBanner ? "pt-16" : "pt-0"].join(" ")}
          refreshControl={<RefreshControl refreshing={feed.isRefreshing} onRefresh={() => void feed.refetch()} />}
        >
          {/* Header */}
          <View className="flex-row items-center">
            {/* left spacer to keep logo centered */}
            <View style={{ width: 44 }} />

            <View className="flex-1 items-center">
              <Image
                source={require("../../assets/images/ponder logo.png")}
                accessibilityLabel="pondr"
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

          {/* Prompt card */}
          {dailyPrompt.prompt && dailyPrompt.isPromptAvailable && !showPromptPopup ? (
            <View className="mt-6">
              <PromptCard
                prompt={dailyPrompt.prompt}
                onOpen={() => setShowPromptPopup(true)}
                onRespond={() => {
                  void dailyPrompt.markPromptOpened();
                  router.replace({
                    pathname: "/(tabs)/create",
                    params: {
                      promptId: dailyPrompt.prompt!.id,
                      promptText: dailyPrompt.prompt!.prompt_text,
                      promptDate: dailyPrompt.prompt!.prompt_date,
                    },
                  });
                }}
              />
            </View>
          ) : null}

          {/* Posts */}
          <View className="mt-8 gap-6">
            {!arePostsVisible ? (
              <View className="items-center justify-center py-10">
                <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Posts release at 12:30pm PT
                </Text>
              </View>
            ) : feed.isLoading ? (
              <View className="items-center justify-center py-10">
                <Text className="font-mono text-sm text-muted-foreground">Loading posts…</Text>
              </View>
            ) : feed.posts.length === 0 ? (
              <View className="items-center justify-center py-10">
                <Text className="font-mono text-sm text-muted-foreground">No posts yet. Create your first PONDR.</Text>
              </View>
            ) : (
              feed.posts.map((post) => (
                <View key={post.id} className="w-full">
                  <PostHeader post={post} />
                  <YimPost post={post} onPress={() => setExpandedPost(post)} />
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
