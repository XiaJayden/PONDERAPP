import { BlurView } from "expo-blur";
import React from "react";
import { Text, View } from "react-native";

import { PostHeader } from "@/components/posts/post-chrome";
import { YimPost, type Post } from "@/components/posts/yim-post";

export function BlurredPost({
  post,
  hintText = "Answer today to reveal",
}: {
  post: Post;
  hintText?: string;
}) {
  const borderRadius = 51; // matches YimPost default signature radius

  return (
    <View className="w-full">
      <PostHeader post={post} />

      <View className="relative w-full overflow-hidden" style={{ borderRadius }}>
        <YimPost post={post} borderRadiusOverride={borderRadius} />

        <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
          <BlurView intensity={35} tint="dark" style={{ position: "absolute", inset: 0 }} />
          <View style={{ position: "absolute", inset: 0 }} className="bg-black/25" />

          <View style={{ position: "absolute", left: 0, right: 0, bottom: 18 }} className="items-center">
            <View className="rounded-full border border-muted bg-card/80 px-4 py-2">
              <Text className="font-mono text-[10px] uppercase tracking-wider text-foreground">{hintText}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}


