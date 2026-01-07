import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { router } from "expo-router";
import { Home, Image as ImageIcon, Plus, User, Users } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/providers/auth-provider";
import { useDailyPrompt } from "@/hooks/useDailyPrompt";

type TabRouteName = "index" | "friends" | "create" | "gallery" | "profile";

const TAB_LABELS: Record<TabRouteName, string> = {
  index: "Feed",
  friends: "Friends",
  create: "Create",
  gallery: "Gallery",
  profile: "Profile",
};

function getIcon(name: TabRouteName, color: string) {
  const props = { color, size: 20 };

  switch (name) {
    case "index":
      return <Home {...props} />;
    case "friends":
      return <Users {...props} />;
    case "gallery":
      return <ImageIcon {...props} />;
    case "profile":
      return <User {...props} />;
    case "create":
      return <Plus {...props} size={36} />;
  }
}

/**
 * Custom bottom nav matching the web app’s “floating create button” pattern.
 *
 * Notes:
 * - Uses a blurred background to keep the “dark minimalism” vibe.
 * - Uses the `font-mono` + uppercase micro-labels like the web nav.
 */
export function BottomNav(props: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const currentRoute = props.state.routes[props.state.index];
  const { user } = useAuth();
  const dailyPrompt = useDailyPrompt();

  // Match web behavior: create is only enabled during the user's response window.
  const canCreate = !!user && dailyPrompt.isInResponseWindow;

  return (
    <View className="bg-transparent">
      <View 
        style={{ 
          backgroundColor: "#241E1A",
          paddingBottom: Math.max(insets.bottom, 16),
        }} 
        className="border-t border-muted px-4 pt-2"
      >
        <View className="flex-row items-end justify-around">
          <NavButton
            routeName="index"
            isActive={currentRoute.name === "index"}
            onPress={() => router.replace("/(tabs)")}
          />

          <NavButton
            routeName="friends"
            isActive={currentRoute.name === "friends"}
            onPress={() => router.replace("/(tabs)/friends")}
          />

          <CreateButton
            isActive={currentRoute.name === "create"}
            isEnabled={canCreate}
            onPress={() => router.replace("/(tabs)/create")}
          />

          <NavButton
            routeName="gallery"
            isActive={currentRoute.name === "gallery"}
            onPress={() => router.replace("/(tabs)/gallery")}
          />

          <NavButton
            routeName="profile"
            isActive={currentRoute.name === "profile"}
            onPress={() => router.replace("/(tabs)/profile")}
          />
        </View>
      </View>
    </View>
  );
}

function NavButton({
  routeName,
  isActive,
  onPress,
}: {
  routeName: Exclude<TabRouteName, "create">;
  isActive: boolean;
  onPress: () => void;
}) {
  const activeColor = "hsl(82 85% 55%)"; // primary color
  const inactiveColor = "#8A8A8A"; // specified non-active color
  const iconColor = isActive ? activeColor : inactiveColor;
  const textColor = isActive ? activeColor : inactiveColor;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      className="min-w-[64px] items-center justify-center gap-1 px-2 py-2"
    >
      <View>{getIcon(routeName, iconColor)}</View>
      <Text style={{ color: textColor }} className="font-mono text-[10px] uppercase tracking-wider">
        {TAB_LABELS[routeName]}
      </Text>
    </Pressable>
  );
}

function CreateButton({ isActive, isEnabled, onPress }: { isActive: boolean; isEnabled: boolean; onPress: () => void }) {
  // Intentionally “dumb” button: gating happens in BottomNav based on prompt timing.

  return (
    <Pressable
      onPress={() => {
        if (!isEnabled) return;
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel="Create"
      accessibilityState={{ selected: isActive, disabled: !isEnabled }}
      className="items-center justify-center"
    >
      <View
        className={[
          "relative -mt-10 items-center justify-center rounded-full",
          isEnabled ? "bg-primary" : "bg-muted",
        ].join(" ")}
        style={{ height: 72, width: 72 }}
      >
        {getIcon("create", isEnabled ? "hsl(0 0% 4%)" : "hsl(0 0% 55%)")}

        {/* Small pulse dot like web app */}
        {isEnabled ? <View className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-accent" /> : null}
      </View>
    </Pressable>
  );
}


