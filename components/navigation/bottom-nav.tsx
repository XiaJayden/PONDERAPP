import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { router } from "expo-router";
import { Eye, Home, Image as ImageIcon, Pencil, Plus, User, Users } from "lucide-react-native";
import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PostPreviewModal } from "@/components/posts/post-preview-modal";
import { useDailyPrompt } from "@/hooks/useDailyPrompt";
import { usePhase } from "@/hooks/usePhase";
import { useYimFeed } from "@/hooks/useYimFeed";
import { useAuth } from "@/providers/auth-provider";
import { useDevTools } from "@/providers/dev-tools-provider";

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
  const feed = useYimFeed();
  const devTools = useDevTools();
  const phase = usePhase(devTools.phaseOverride);

  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

  // In the posting/viewing cycle:
  // - Before answering: plus opens the prompt popup
  // - After answering in posting phase: pencil icon allows editing post
  // - In viewing phase: eye icon previews today's post
  const hasAnsweredToday = !!user && dailyPrompt.hasAnsweredToday;
  const canOpenPrompt = !!user && !!dailyPrompt.prompt;
  const isPostingPhase = phase.phase === "posting";
  const showEditButton = hasAnsweredToday && isPostingPhase && !!feed.pendingPost;
  const createEnabled = showEditButton || (hasAnsweredToday && !isPostingPhase && !!feed.pendingPost) || (!hasAnsweredToday && canOpenPrompt);

  return (
    <View className="bg-transparent">
      <PostPreviewModal isVisible={isPreviewOpen} post={feed.pendingPost ?? null} onClose={() => setIsPreviewOpen(false)} />

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
            isEnabled={createEnabled}
            variant={showEditButton ? "edit" : hasAnsweredToday ? "preview" : "create"}
            onPress={() => {
              if (showEditButton) {
                // Navigate to edit existing post
                if (!feed.pendingPost) {
                  Alert.alert("No post found", "You haven't submitted today's post yet.");
                  return;
                }
                if (!dailyPrompt.prompt) {
                  Alert.alert("No prompt available", "There is no daily prompt to respond to right now.");
                  return;
                }
                router.replace({
                  pathname: "/(tabs)/create",
                  params: {
                    promptId: dailyPrompt.prompt.id,
                    promptText: dailyPrompt.prompt.prompt_text,
                    promptDate: dailyPrompt.prompt.prompt_date,
                    postId: feed.pendingPost.id,
                    edit: "true",
                  },
                });
                return;
              }

              if (hasAnsweredToday) {
                if (!feed.pendingPost) {
                  Alert.alert("No pending post", "You haven't submitted today's post yet.");
                  return;
                }
                setIsPreviewOpen(true);
                return;
              }

              if (!canOpenPrompt) return;
              devTools.openPromptPopup();
            }}
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

function CreateButton({
  isActive,
  isEnabled,
  variant,
  onPress,
}: {
  isActive: boolean;
  isEnabled: boolean;
  variant: "create" | "preview" | "edit";
  onPress: () => void;
}) {
  // Intentionally "dumb" button: gating happens in BottomNav based on prompt timing.

  const bgColor = isEnabled
    ? variant === "edit"
      ? "hsl(47 96% 53%)" // yellow
      : variant === "preview"
        ? "bg-foreground"
        : "bg-primary"
    : "bg-muted";

  return (
    <Pressable
      onPress={() => {
        if (!isEnabled) return;
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={variant === "edit" ? "Edit" : variant === "preview" ? "Preview" : "Create"}
      accessibilityState={{ selected: isActive, disabled: !isEnabled }}
      className="items-center justify-center"
    >
      <View
        className={["relative -mt-10 items-center justify-center rounded-full", isEnabled ? "" : "bg-muted"].join(" ")}
        style={{
          height: 72,
          width: 72,
          backgroundColor: isEnabled
            ? variant === "edit"
              ? "hsl(47 96% 53%)"
              : variant === "preview"
                ? "hsl(60 9% 98%)"
                : "hsl(82 85% 55%)"
            : "hsl(0 0% 55%)",
        }}
      >
        {variant === "edit" ? (
          <Pencil color={isEnabled ? "hsl(0 0% 4%)" : "hsl(0 0% 55%)"} size={30} />
        ) : variant === "preview" ? (
          <Eye color={isEnabled ? "hsl(0 0% 4%)" : "hsl(0 0% 55%)"} size={30} />
        ) : (
          getIcon("create", isEnabled ? "hsl(0 0% 4%)" : "hsl(0 0% 55%)")
        )}
      </View>
    </Pressable>
  );
}


