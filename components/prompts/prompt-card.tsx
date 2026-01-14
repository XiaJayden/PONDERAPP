import React from "react";
import { Pressable, Text, View } from "react-native";

import type { DailyPrompt } from "@/hooks/useDailyPrompt";
import { FormattedText } from "./formatted-text";

/**
 * Compact prompt card.
 *
 * Web behavior:
 * - Tap to open the full prompt popup
 * - “Respond” CTA routes to create flow
 */
export function PromptCard({
  prompt,
  onOpen,
  onRespond,
}: {
  prompt: DailyPrompt;
  onOpen: () => void;
  onRespond: () => void;
}) {
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel="Open prompt"
      className="rounded-2xl border border-muted bg-card p-5"
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Today’s PONDER</Text>
        <Pressable onPress={onOpen} accessibilityRole="button">
          <Text className="font-mono text-xs text-primary">Open</Text>
        </Pressable>
      </View>

      <FormattedText className="mt-3 font-playfair text-2xl leading-tight text-foreground" boldClassName="font-playfair-semibold">{prompt.prompt_text}</FormattedText>

      <Pressable
        onPress={onRespond}
        accessibilityRole="button"
        className="mt-3 items-center justify-center rounded-xl bg-primary px-4 py-3"
      >
        <Text className="font-mono text-xs uppercase tracking-wider text-background">Respond</Text>
      </Pressable>
    </Pressable>
  );
}






