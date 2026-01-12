import { router } from "expo-router";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { PromptPopup } from "@/components/prompts/prompt-popup";
import { useDailyPrompt } from "@/hooks/useDailyPrompt";
import { clearPromptPopupShown, setDevHasRespondedOverride } from "@/lib/prompt-store";
import { type Phase } from "@/lib/phase";
import { supabase } from "@/lib/supabase";
import { getTodayPacificIsoDate } from "@/lib/timezone";
import { useAuth } from "@/providers/auth-provider";
import { clearWelcomeSeen } from "@/lib/welcome-store";

type DevToolsContextValue = {
  isPromptPopupVisible: boolean;
  openPromptPopup: () => void;
  closePromptPopup: () => void;

  resetCycle: () => Promise<void>;

  phaseOverride: Phase | null;
  setPhaseOverride: (phase: Phase | null) => void;

  showAllPosts: boolean;
  setShowAllPosts: (value: boolean) => void;

  showWelcome: () => Promise<void>;
  resetWelcome: () => Promise<void>;
};

const DevToolsContext = createContext<DevToolsContextValue | null>(null);

export function useDevTools(): DevToolsContextValue {
  const ctx = useContext(DevToolsContext);
  if (!ctx) {
    // Provide a clear error in dev; in prod this provider is not mounted.
    throw new Error("useDevTools must be used within DevToolsProvider");
  }
  return ctx;
}

export function DevToolsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const dailyPrompt = useDailyPrompt();
  const queryClient = useQueryClient();

  const [isPromptPopupVisible, setIsPromptPopupVisible] = useState(false);
  const [phaseOverride, setPhaseOverride] = useState<Phase | null>(null);
  const [showAllPosts, setShowAllPosts] = useState(false);

  const openPromptPopup = useCallback(() => {
    if (!dailyPrompt.prompt) {
      Alert.alert("No prompt available", "There is no daily prompt to respond to right now.");
      return;
    }
    setIsPromptPopupVisible(true);
  }, [dailyPrompt.prompt]);

  const closePromptPopup = useCallback(() => setIsPromptPopupVisible(false), []);

  const resetCycle = useCallback(async () => {
    if (!__DEV__) return;
    if (!user?.id) {
      console.log("[resetCycle] No user, skipping");
      return;
    }
    if (!dailyPrompt.prompt) {
      console.log("[resetCycle] No prompt available, skipping");
      return;
    }

    console.log("[resetCycle] Starting reset", { userId: user.id, promptId: dailyPrompt.prompt.id });

    setIsPromptPopupVisible(false);
    const prompt = dailyPrompt.prompt;
    const todayPacific = getTodayPacificIsoDate();

    // Delete any existing post for this prompt so the user can re-post (dev testing only).
    // Use .select() to see how many rows were affected.
    const { data: deletedRows, error: deleteError } = await supabase
      .from("yim_posts")
      .delete()
      .eq("author_id", user.id)
      .eq("prompt_id", prompt.id)
      .select("id");

    if (deleteError) {
      console.warn("[resetCycle] Failed to delete existing post", deleteError);
      Alert.alert("Reset failed", `Could not delete existing post: ${deleteError.message}`);
      return;
    }

    console.log("[resetCycle] Delete result", { deletedCount: deletedRows?.length ?? 0, promptId: prompt.id });

    await clearPromptPopupShown({ userId: user.id, promptId: prompt.id, dateKey: todayPacific });
    await setDevHasRespondedOverride({ userId: user.id, promptId: prompt.id, promptDate: prompt.prompt_date, value: false });

    // Refresh any cached data for the cycle.
    await queryClient.invalidateQueries();

    console.log("[resetCycle] Complete");
  }, [dailyPrompt.prompt, queryClient, user?.id]);

  const showWelcome = useCallback(async () => {
    if (!__DEV__) return;
    if (!user?.id) {
      Alert.alert("No user", "Please log in first.");
      return;
    }
    await clearWelcomeSeen(user.id);
    // Navigate to welcome screen
    router.push("/(auth)/welcome");
  }, [user?.id]);

  const resetWelcome = useCallback(async () => {
    if (!__DEV__) return;
    if (!user?.id) {
      Alert.alert("No user", "Please log in first.");
      return;
    }
    await clearWelcomeSeen(user.id);
    Alert.alert("Welcome reset", "Welcome screen flag has been cleared. Navigate to welcome screen to see it again.");
  }, [user?.id]);

  const value = useMemo<DevToolsContextValue>(
    () => ({
      isPromptPopupVisible,
      openPromptPopup,
      closePromptPopup,
      resetCycle,
      phaseOverride,
      setPhaseOverride,
      showAllPosts,
      setShowAllPosts,
      showWelcome,
      resetWelcome,
    }),
    [
      closePromptPopup,
      isPromptPopupVisible,
      openPromptPopup,
      resetCycle,
      phaseOverride,
      setPhaseOverride,
      showAllPosts,
      showWelcome,
      resetWelcome,
    ]
  );

  return (
    <DevToolsContext.Provider value={value}>
      {children}

      {/* Global prompt popup host (nav/feed can open from anywhere). */}
      {dailyPrompt.prompt ? (
        <PromptPopup
          isVisible={isPromptPopupVisible}
          prompt={dailyPrompt.prompt}
          onClose={closePromptPopup}
          onRespond={() => {
            closePromptPopup();
            router.replace({
              pathname: "/(tabs)/create",
              params: {
                promptId: dailyPrompt.prompt!.id,
                promptText: dailyPrompt.prompt!.prompt_text,
                promptDate: dailyPrompt.prompt!.prompt_date,
              },
            });
          }}
        />
      ) : null}
    </DevToolsContext.Provider>
  );
}


