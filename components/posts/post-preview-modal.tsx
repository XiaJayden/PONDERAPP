import React from "react";
import { Image, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { YimPost, type Post } from "@/components/posts/yim-post";

export function PostPreviewModal({
  isVisible,
  post,
  onClose,
}: {
  isVisible: boolean;
  post: Post | null;
  onClose: () => void;
}) {
  if (!post) return null;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
    >
      <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-background">
        <ScrollView className="flex-1" contentContainerClassName="px-4 pb-24">
          <View className="flex-row items-center pt-2">
            <View style={{ width: 40 }} />

            <View className="flex-1 items-center">
              <Image
                source={require("../../assets/images/ponder logo.png")}
                accessibilityLabel="ponder"
                style={{ width: 220, height: 70, resizeMode: "contain" }}
              />
            </View>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
              className="h-10 w-10 items-center justify-center"
            >
              <X color="hsl(60 9% 98%)" size={22} />
            </Pressable>
          </View>

          <View className="mt-3">
            <YimPost post={post} />
          </View>

          <View className="mt-6 rounded-2xl border border-muted bg-card p-4">
            <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              This will be visible to friends tomorrow at 6AM.
            </Text>

            {post.expandedText?.trim() ? (
              <Text style={{ fontFamily: "SpaceMono", fontSize: 16, lineHeight: 22 }} className="mt-4 text-foreground">
                {post.expandedText}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}


