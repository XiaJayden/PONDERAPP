import { router } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";

export default function ActivityScreen() {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="px-4 pt-2">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center"
            hitSlop={10}
          >
            <ChevronLeft color="hsl(60 9% 98%)" size={24} />
          </Pressable>

          <Text className="font-display text-2xl text-foreground">Activity</Text>
          <View style={{ width: 40 }} />
        </View>

        <View className="mt-8 rounded-2xl border border-muted bg-card p-5">
          <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Coming soon</Text>
          <Text className="mt-3 font-body text-base text-foreground">
            Notifications and activity will show up here.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}








