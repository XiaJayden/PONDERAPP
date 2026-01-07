import React, { useMemo } from "react";
import { Text, View } from "react-native";

/**
 * Posting window banner (top-of-feed).
 *
 * Matches web behavior:
 * - Shows when user is in their 30-min window
 * - Or when window is closed but posts haven't released yet (countdown to release)
 */

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
}

export function PostingWindowBanner({
  isActive,
  timeRemainingMs,
  timeUntilReleaseMs,
  isResponseWindowOpen,
}: {
  isActive: boolean;
  timeRemainingMs?: number | null;
  timeUntilReleaseMs?: number | null;
  isResponseWindowOpen: boolean;
}) {
  const label = useMemo(() => {
    if (isActive) return "Your window is open";
    if (!isResponseWindowOpen) return "Window closed";
    return "Waiting for release";
  }, [isActive, isResponseWindowOpen]);

  const countdown = useMemo(() => {
    if (isActive && timeRemainingMs != null) return formatCountdown(timeRemainingMs);
    if (!isResponseWindowOpen && timeUntilReleaseMs != null) return formatCountdown(timeUntilReleaseMs);
    if (timeUntilReleaseMs != null) return formatCountdown(timeUntilReleaseMs);
    return null;
  }, [isActive, isResponseWindowOpen, timeRemainingMs, timeUntilReleaseMs]);

  return (
    <View className="absolute left-0 right-0 top-0 z-20 border-b border-muted bg-card/80 px-4 py-3">
      <View className="flex-row items-center justify-between">
        <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{label}</Text>

        {countdown ? (
          <Text className="font-mono text-xs text-foreground">
            {countdown.hours > 0 ? `${String(countdown.hours).padStart(2, "0")}:` : ""}
            {String(countdown.minutes).padStart(2, "0")}:{String(countdown.seconds).padStart(2, "0")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}




