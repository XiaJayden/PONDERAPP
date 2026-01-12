import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import { markWelcomeSeen } from "@/lib/welcome-store";
import { WelcomeScreen } from "@/components/welcome/welcome-screen";

export default function WelcomeRoute() {
  const { user } = useAuth();

  const handleFinish = async () => {
    if (user?.id) {
      await markWelcomeSeen(user.id);
    }
    if (__DEV__) console.log("[welcome] complete → tabs");
    router.replace("/(tabs)");
  };

  // Prevent navigation away from welcome screen when it's intentionally being shown
  useFocusEffect(
    useCallback(() => {
      if (__DEV__) console.log("[welcome] screen focused");
      return () => {
        if (__DEV__) console.log("[welcome] screen unfocused");
      };
    }, [])
  );

  if (!user) {
    // Should not happen, but handle gracefully
    router.replace("/(auth)/login");
    return null;
  }

  return <WelcomeScreen onFinish={handleFinish} />;
}
