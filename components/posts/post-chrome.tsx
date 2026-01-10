import { Bookmark, Heart, MessageCircle, MoreHorizontal } from "lucide-react-native";
import React, { useMemo } from "react";
import { ActionSheetIOS, Alert, Image, Platform, Pressable, Text, View } from "react-native";

import type { Post } from "@/components/posts/yim-post";

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

export function PostFooterActions() {
  return (
    <View className="mt-3 flex-row items-center justify-start gap-6 pl-6">
      <Pressable accessibilityRole="button" accessibilityLabel="Like" className="py-2">
        <Heart color="hsl(60 9% 98%)" size={22} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Comment" className="py-2">
        <MessageCircle color="hsl(60 9% 98%)" size={22} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Save" className="py-2">
        <Bookmark color="hsl(60 9% 98%)" size={22} />
      </Pressable>
    </View>
  );
}


