import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useDevTools } from "@/providers/dev-tools-provider";

/**
 * Dev-only floating panel to toggle app states quickly.
 * Intentionally simple: shows in dev build, hidden in production.
 */
export function DevToolsPanel() {
  const devTools = useDevTools();
  const [isOpen, setIsOpen] = useState(false);

  const items = useMemo(() => [{ id: "reset", label: "Reset Cycle" as const }], []);

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 12, bottom: 104, zIndex: 9999 }}>
      <View pointerEvents="auto" className="overflow-hidden rounded-2xl border border-muted bg-card/90">
        {isOpen ? (
          <View className="p-2">
            <Text className="px-2 pb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Dev Tools
            </Text>

            <View className="gap-2">
              {items.map((it) => {
                return (
                  <Pressable
                    key={it.id}
                    onPress={() => void devTools.resetCycle()}
                    className="w-[140px] rounded-xl bg-destructive px-3 py-2"
                  >
                    <Text
                      className="font-mono text-xs uppercase tracking-wider text-foreground"
                    >
                      {it.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable onPress={() => setIsOpen(false)} className="mt-2 items-center rounded-xl bg-muted px-3 py-2">
              <Text className="font-mono text-[10px] uppercase tracking-wider text-foreground">Close</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setIsOpen(true)} className="px-3 py-2">
            <Text className="font-mono text-[10px] uppercase tracking-wider text-foreground">Dev</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}




