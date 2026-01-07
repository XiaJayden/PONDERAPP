import { Stack, router } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@/providers/auth-provider";

/**
 * Auth group layout:
 * - If already signed in, bounce to tabs.
 */
export default function AuthLayout() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      if (__DEV__) console.log("[auth-layout] user present → redirecting to tabs");
      router.replace("/(tabs)");
    }
  }, [isLoading, user]);

  return <Stack screenOptions={{ headerShown: false }} />;
}


