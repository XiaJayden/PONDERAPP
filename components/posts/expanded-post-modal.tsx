import React from "react";
import { Image, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { YimPost, type Post } from "@/components/posts/yim-post";

/**
 * Expanded post modal:
 * - Full-screen reading
 * - Read-only (no editing)
 */
export function ExpandedPostModal({
  isVisible,
  post,
  onClose,
  onUpdated,
}: {
  isVisible: boolean;
  post: Post | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  if (!post) return null;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      onRequestClose={onClose}
      // iOS best practice: pageSheet enables the native swipe-down-to-dismiss gesture.
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
    >
      <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-background">
        <ScrollView className="flex-1" contentContainerClassName="px-4 pb-24">
          <View className="flex-row items-center pt-2">
            {/* left spacer to keep logo perfectly centered */}
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

          {/* Response (read-only, scrolls with page) */}
          <View className="mt-6 rounded-2xl border border-muted bg-card p-4">
            {post.expandedText?.trim() ? (
              <Text style={{ fontFamily: "SpaceMono", fontSize: 16, lineHeight: 22 }} className="text-foreground">
                {post.expandedText}
              </Text>
            ) : (
              <Text style={{ fontFamily: "SpaceMono", fontSize: 14, lineHeight: 20 }} className="text-muted-foreground">
                No response yet.
              </Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}




