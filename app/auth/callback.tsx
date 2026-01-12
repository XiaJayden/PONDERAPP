import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/providers/auth-provider";

export default function AuthCallbackScreen() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{ error?: string; error_description?: string }>();

  const errorMessage = useMemo(() => {
    if (typeof params?.error_description === "string") return params.error_description;
    if (typeof params?.error === "string") return params.error;
    return null;
  }, [params?.error, params?.error_description]);

  useEffect(() => {
    if (errorMessage) {
      router.replace("/(auth)/login");
      return;
    }
    // The actual code->session exchange is handled in `AuthProvider` via Linking listeners.
    if (session) router.replace("/(tabs)");
  }, [errorMessage, session]);

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <ActivityIndicator />
        <Text className="mt-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Finishing sign-in…
        </Text>
      </View>
    </SafeAreaView>
  );
}


