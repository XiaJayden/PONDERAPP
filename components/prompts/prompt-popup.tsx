import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { X } from "lucide-react-native";

import type { DailyPrompt } from "@/hooks/useDailyPrompt";

/**
 * Full-screen prompt popup.
 *
 * Minimal, calm, typography-forward (design.md).
 */
export function PromptPopup({
  isVisible,
  prompt,
  onClose,
  onRespond,
}: {
  isVisible: boolean;
  prompt: DailyPrompt;
  onClose: () => void;
  onRespond: () => void;
}) {
  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 px-4">
        {/* Taller, bottom-sheet style container */}
        <View className="flex-1 justify-end pb-10">
          <View className="min-h-[420px] rounded-3xl border border-muted bg-card p-6">
            <View className="flex-row items-center justify-between">
              <Text className="font-mono text-xs uppercase tracking-wider text-primary">Today’s PONDR</Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                className="h-10 w-10 items-center justify-center"
                hitSlop={10}
              >
                <X color="hsl(0 0% 55%)" size={18} />
              </Pressable>
            </View>

            {/* Intro / context */}
            {!!prompt.explanation_text ? (
              <Text className="mt-5 font-body text-base leading-relaxed text-muted-foreground">
                {prompt.explanation_text}
              </Text>
            ) : (
              <Text className="mt-5 font-body text-base leading-relaxed text-muted-foreground">
                Take a moment. Read slowly. Then answer honestly.
              </Text>
            )}

            {/* Punchline question anchored toward the bottom */}
            <View className="mt-6 flex-1 justify-end">
              <Text className="font-playfair text-3xl leading-tight text-foreground">
                {prompt.prompt_text}
              </Text>

              <Pressable
                onPress={onRespond}
                accessibilityRole="button"
                className="mt-4 items-center justify-center rounded-xl bg-primary px-4 py-3"
              >
                <Text className="font-mono text-xs uppercase tracking-wider text-background">Respond</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}




