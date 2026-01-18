import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Carousel from "react-native-reanimated-carousel";

import { ExpandedPostModal } from "@/components/posts/expanded-post-modal";
import { PostHeader } from "@/components/posts/post-chrome";
import { YimPost, type Post } from "@/components/posts/yim-post";
import { useSavedPosts } from "@/hooks/useSavedPosts";

export default function GalleryScreen() {
  const { posts, isLoading } = useSavedPosts();
  const [expandedPost, setExpandedPost] = useState<Post | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);

  const activePost = useMemo(() => posts[activeIndex] ?? null, [activeIndex, posts]);
  const cardWidth = viewportWidth > 0 ? Math.round(viewportWidth * 0.86) : 0;
  const cardHeight = cardWidth; // `YimPost` is aspect-square
  const sidePad = viewportWidth > 0 && cardWidth > 0 ? Math.max(0, Math.round((viewportWidth - cardWidth) / 2)) : 0;

  // Navigation is swipe-based; no arrow buttons.

  useEffect(() => {
    if (activeIndex >= posts.length && posts.length > 0) setActiveIndex(0);
  }, [activeIndex, posts.length]);

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
        <View className="items-center justify-center">
          <Text className="font-display text-4xl text-foreground">Your Gallery</Text>
        </View>

        {isLoading ? (
          <View className="mt-10 items-center justify-center">
            <Text className="font-mono text-sm text-muted-foreground">Loading gallery…</Text>
          </View>
        ) : posts.length === 0 ? (
          <View className="mt-10 items-center justify-center">
            <Text className="font-mono text-sm text-muted-foreground">Your gallery is empty.</Text>
          </View>
        ) : (
          <View className="mt-6 flex-1" style={{ overflow: "visible" }}>
            <View
              style={{ flex: 1, justifyContent: "center", overflow: "visible" }}
              onLayout={(e) => {
                const width = e.nativeEvent.layout.width;
                if (width > 0 && width !== viewportWidth) setViewportWidth(width);
              }}
            >
              {viewportWidth > 0 && cardWidth > 0 ? (
                <Carousel
                  width={viewportWidth}
                  height={cardHeight}
                  data={posts}
                  loop={false}
                  style={{ width: viewportWidth, overflow: "visible" }}
                  pagingEnabled
                  snapEnabled
                  scrollAnimationDuration={320}
                  onSnapToItem={(index) => setActiveIndex(index)}
                  renderItem={({ item }) => (
                    <View style={{ width: viewportWidth, alignItems: "center", overflow: "visible" }}>
                      <View style={{ width: cardWidth, marginHorizontal: sidePad, overflow: "visible" }}>
                        <Pressable onPress={() => setExpandedPost(item)} accessibilityRole="button">
                          <YimPost post={item} previewMode />
                        </Pressable>
                      </View>
                    </View>
                  )}
                  mode="parallax"
                  modeConfig={{
                    // Bring neighbors closer (less spacing) and keep the active card larger.
                    parallaxScrollingScale: 0.96,
                    parallaxScrollingOffset: Math.round(cardWidth * 0.06),
                  }}
                />
              ) : null}
            </View>

            {/* Dots */}
            {posts.length > 1 ? (
              <View className="mt-6 items-center">
                <View className="flex-row items-center gap-2">
                  {posts.map((_, idx) => (
                    <View
                      key={`dot-${idx}`}
                      className={[
                        "rounded-full",
                        idx === activeIndex ? "h-2 w-10 bg-primary" : "h-2 w-2 bg-muted",
                      ].join(" ")}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {/* Author Info */}
            {activePost ? (
              <View className="mt-8 rounded-2xl border border-muted bg-card p-5">
                <View className="mb-4">
                  <PostHeader post={activePost} />
                </View>
                <View className="gap-2">
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


