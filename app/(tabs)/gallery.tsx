import React, { useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ExpandedPostModal } from "@/components/posts/expanded-post-modal";
import { PostHeader } from "@/components/posts/post-chrome";
import { YimPost, type Post } from "@/components/posts/yim-post";
import { useSavedPosts } from "@/hooks/useSavedPosts";

export default function GalleryScreen() {
  const { posts, isLoading } = useSavedPosts();
  const [expandedPost, setExpandedPost] = useState<Post | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const listRef = useRef<FlatList<Post> | null>(null);

  const activePost = useMemo(() => posts[activeIndex] ?? null, [activeIndex, posts]);
  const cardWidth = viewportWidth > 0 ? Math.round(viewportWidth * 0.86) : 0;
  const sidePad = viewportWidth > 0 && cardWidth > 0 ? Math.max(0, Math.round((viewportWidth - cardWidth) / 2)) : 0;
  // Overlap neighbors slightly so they appear "behind" the active card.
  const overlap = cardWidth > 0 ? Math.round(cardWidth * 0.18) : 0;
  const snapInterval = cardWidth > 0 ? Math.max(1, cardWidth - overlap) : 0;

  // Navigation is swipe-based; no arrow buttons.

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
            <FlatList
              ref={(r) => {
                listRef.current = r;
              }}
              data={posts}
              keyExtractor={(p) => p.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={snapInterval > 0 ? snapInterval : undefined}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: sidePad }}
              style={{ overflow: "visible" }}
              onMomentumScrollEnd={(e) => {
                const interval = snapInterval > 0 ? snapInterval : e.nativeEvent.layoutMeasurement.width;
                const index = Math.round(e.nativeEvent.contentOffset.x / interval);
                setActiveIndex(index);
              }}
              renderItem={({ item, index }) => {
                const isActive = index === activeIndex;
                const dist = Math.abs(index - activeIndex);
                const zIndex = isActive ? 30 : dist === 1 ? 20 : 10;
                return (
                  <View
                    style={{
                      width: cardWidth || "100%",
                      // Negative spacing creates the overlap stack.
                      marginRight: index === posts.length - 1 ? 0 : -overlap,
                      zIndex,
                      elevation: zIndex, // helps Android stacking
                      overflow: "visible",
                    }}
                  >
                    <Pressable onPress={() => setExpandedPost(item)} accessibilityRole="button">
                      <View
                        style={[
                          { borderRadius: 51 },
                          isActive
                            ? {
                                shadowColor: "hsl(60 9% 98%)",
                                shadowOpacity: 0.22,
                                shadowRadius: 22,
                                shadowOffset: { width: 0, height: 0 },
                                elevation: 12,
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.16)",
                              }
                            : {
                                opacity: 0.8,
                                transform: [{ scale: dist === 1 ? 0.96 : 0.94 }],
                              },
                        ]}
                      >
                        <YimPost post={item} previewMode />
                      </View>
                    </Pressable>
                  </View>
                );
              }}
              onLayout={(e) => {
                const width = e.nativeEvent.layout.width;
                if (width > 0 && width !== viewportWidth) {
                  setViewportWidth(width);
                }
              }}
              getItemLayout={
                snapInterval > 0
                  ? (_, index) => ({
                      length: snapInterval,
                      offset: snapInterval * index,
                      index,
                    })
                  : undefined
              }
            />

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


