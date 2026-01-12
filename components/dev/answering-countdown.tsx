import React, { useMemo } from "react";
import { Text, View } from "react-native";

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
}

function TimeBox({ value, label }: { value: string; label: string }) {
  return (
    <View className="items-center">
      <View
        className="items-center justify-center rounded-2xl border border-muted bg-card/60"
        style={{ width: 92, height: 92 }}
      >
        <Text
          className="font-mono text-foreground"
          style={{
            fontSize: 44,
            lineHeight: 54, // prevent top clipping on some platforms/font rendering
            includeFontPadding: false,
          }}
        >
          {value}
        </Text>
      </View>
      <Text className="mt-2 font-mono text-[12px] uppercase tracking-wider text-muted-foreground">{label}</Text>
    </View>
  );
}

export function AnsweringStateCountdown({ timeUntilReleaseMs }: { timeUntilReleaseMs: number | null }) {
  const countdown = useMemo(() => formatCountdown(timeUntilReleaseMs ?? 0), [timeUntilReleaseMs]);

  return (
    <View className="items-center justify-center py-14">
      <Text className="mb-10 font-mono text-[14px] uppercase tracking-[3px] text-muted-foreground">
        Until viewing
      </Text>

      <View className="flex-row gap-6">
        <TimeBox value={String(countdown.hours).padStart(2, "0")} label="Hours" />
        <TimeBox value={String(countdown.minutes).padStart(2, "0")} label="Minutes" />
        <TimeBox value={String(countdown.seconds).padStart(2, "0")} label="Seconds" />
      </View>
    </View>
  );
}


