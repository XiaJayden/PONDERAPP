import React, { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ExpandedPostModal } from "@/components/posts/expanded-post-modal";
import { YimPost, type Post } from "@/components/posts/yim-post";
import { PostFooterActions, PostHeader } from "@/components/posts/post-chrome";
import { useGallery } from "@/hooks/useGallery";

export default function GalleryScreen() {
  const { posts, isLoading } = useGallery();
  const [expandedPost, setExpandedPost] = useState<Post | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const activePost = useMemo(() => posts[activeIndex] ?? null, [activeIndex, posts]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ExpandedPostModal
        isVisible={!!expandedPost}
        post={expandedPost}
        onClose={() => setExpandedPost(null)}
        onUpdated={() => {
          // Gallery reuses user posts hook; a refresh happens via that hook.
        }}
      />

      <View className="flex-1 px-4 pt-6 pb-24">
        <Text className="font-display text-3xl text-foreground">Your Gallery</Text>

        {isLoading ? (
          <View className="mt-10 items-center justify-center">
            <Text className="font-mono text-sm text-muted-foreground">Loading gallery…</Text>
          </View>
        ) : posts.length === 0 ? (
          <View className="mt-10 items-center justify-center">
            <Text className="font-mono text-sm text-muted-foreground">Your gallery is empty.</Text>
          </View>
        ) : (
          <View className="mt-6 flex-1">
            <FlatList
              data={posts}
              keyExtractor={(p) => p.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const width = e.nativeEvent.layoutMeasurement.width;
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                setActiveIndex(index);
              }}
              renderItem={({ item }) => (
                <View style={{ width: "100%" }} className="pr-4">
                  <PostHeader post={item} />
                  <Pressable onPress={() => setExpandedPost(item)} accessibilityRole="button">
                    <YimPost post={item} previewMode />
                  </Pressable>
                  <PostFooterActions />
                </View>
              )}
            />

            {/* Plaque */}
            {activePost ? (
              <View className="mt-8 rounded-2xl border border-muted bg-card p-5">
                {!!activePost.promptId ? (
                  <View className="gap-2">
                    <Text className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Prompt</Text>
                    <Text className="font-body text-sm text-muted-foreground">
                      {activePost.promptId}
                    </Text>
                  </View>
                ) : null}

                <View className="mt-4 gap-2">
                  <Text className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Date</Text>
                  <Text className="font-mono text-sm text-foreground">{activePost.date}</Text>
                </View>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}


