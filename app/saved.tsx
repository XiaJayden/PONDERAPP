import React, { useState } from "react";
import { FlatList, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";

import { ExpandedPostModal } from "@/components/posts/expanded-post-modal";
import { YimPost, type Post } from "@/components/posts/yim-post";
import { useSavedPosts } from "@/hooks/useSavedPosts";

export default function SavedPostsScreen() {
  const { posts, isLoading, errorMessage } = useSavedPosts();
  const [expandedPost, setExpandedPost] = useState<Post | null>(null);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ExpandedPostModal
        isVisible={!!expandedPost}
        post={expandedPost}
        onClose={() => setExpandedPost(null)}
        onUpdated={() => {
          // Saved posts will refresh via the hook
        }}
      />

      {/* Header */}
      <View className="flex-row items-center px-4 pt-6 pb-4">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-10 w-10 items-center justify-center"
        >
          <ArrowLeft color="hsl(60 9% 98%)" size={22} />
        </Pressable>

        <View className="flex-1 items-center">
          <Text className="font-display text-4xl text-foreground">Saved</Text>
        </View>

        {/* Right spacer for centering */}
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-mono text-sm text-muted-foreground">Loading saved posts…</Text>
        </View>
      ) : errorMessage ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="font-mono text-sm text-destructive">{errorMessage}</Text>
        </View>
      ) : posts.length === 0 ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="font-mono text-lg text-foreground">No saved posts</Text>
          <Text className="mt-2 text-center font-mono text-sm text-muted-foreground">
            Posts you save will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          columnWrapperStyle={{ gap: 16 }}
          renderItem={({ item }) => (
            <View className="flex-1">
              <Pressable onPress={() => setExpandedPost(item)} accessibilityRole="button">
                <YimPost post={item} size="sm" previewMode hideFooter />
              </Pressable>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
