import { router } from "expo-router";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { PromptPopup } from "@/components/prompts/prompt-popup";
import { useDailyPrompt } from "@/hooks/useDailyPrompt";
import { clearPromptPopupShown, clearUserPromptOpenTime, setDevHasRespondedOverride } from "@/lib/prompt-store";
import { getTodayPacificIsoDate } from "@/lib/timezone";
import { useAuth } from "@/providers/auth-provider";

type DevToolsContextValue = {
  isPromptPopupVisible: boolean;
  openPromptPopup: () => void;
  closePromptPopup: () => void;

  resetCycle: () => Promise<void>;
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

  const openPromptPopup = useCallback(() => {
    if (!dailyPrompt.prompt) {
      Alert.alert("No prompt available", "There is no daily prompt to respond to right now.");
      return;
    }
    // In the single-login cycle, opening the prompt is what starts the 15-min window.
    void dailyPrompt.markPromptOpened();
    setIsPromptPopupVisible(true);
  }, [dailyPrompt.prompt]);

  const closePromptPopup = useCallback(() => setIsPromptPopupVisible(false), []);

  const resetCycle = useCallback(async () => {
    if (!__DEV__) return;
    if (!user?.id) return;
    if (!dailyPrompt.prompt) return;

    setIsPromptPopupVisible(false);
    const prompt = dailyPrompt.prompt;
    const todayPacific = getTodayPacificIsoDate();

    await clearUserPromptOpenTime({ userId: user.id, promptId: prompt.id, promptDate: prompt.prompt_date });
    await clearPromptPopupShown({ userId: user.id, promptId: prompt.id, dateKey: todayPacific });
    await setDevHasRespondedOverride({ userId: user.id, promptId: prompt.id, promptDate: prompt.prompt_date, value: false });

    // Refresh any cached data for the cycle.
    await queryClient.invalidateQueries();
  }, [dailyPrompt.prompt, queryClient, user?.id]);

  const value = useMemo<DevToolsContextValue>(
    () => ({
      isPromptPopupVisible,
      openPromptPopup,
      closePromptPopup,
      resetCycle,
    }),
    [
      closePromptPopup,
      isPromptPopupVisible,
      openPromptPopup,
      resetCycle,
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


