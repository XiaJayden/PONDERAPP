import { Stack, router, useSegments } from "expo-router";
import { useEffect, useState } from "react";

import { useAuth } from "@/providers/auth-provider";
import { useProfile } from "@/hooks/useProfile";
import { hasSeenWelcome } from "@/lib/welcome-store";

/**
 * Auth group layout:
 * - If already signed in AND onboarding complete, bounce to tabs.
 * - If signed in but needs onboarding, stay in auth flow (allow onboarding screen).
 * - If email not confirmed, stay in auth flow (allow verification popup on login).
 */
export default function AuthLayout() {
  const { user, isLoading: isAuthLoading, isEmailConfirmed } = useAuth();
  const { profile, isLoading: isProfileLoading } = useProfile();
  const [isCheckingWelcome, setIsCheckingWelcome] = useState(false);
  const segments = useSegments();

  useEffect(() => {
    if (isAuthLoading) return;
    
    // No user - stay in auth flow
    if (!user) return;

    // Email not confirmed - stay in auth flow (login screen shows verification popup)
    if (!isEmailConfirmed) {
      if (__DEV__) console.log("[auth-layout] email not confirmed → staying in auth");
      return;
    }

    // Wait for profile to load before deciding
    if (isProfileLoading) return;

    // Check if we're already on the welcome screen - don't redirect away from it
    // segments could be ["(auth)", "welcome"] or ["welcome"] depending on route structure
    const isOnWelcomeScreen = segments.some((seg) => seg === "welcome" || seg.includes("welcome"));
    if (isOnWelcomeScreen) {
      if (__DEV__) console.log("[auth-layout] already on welcome screen → staying", { segments });
      return;
    }

    // Check if onboarding is complete
    const onboardingComplete = 
      profile?.onboarding_complete &&
      profile?.first_name &&
      profile?.username &&
      profile?.birthday;

    if (!onboardingComplete) {
      // User needs onboarding - stay in auth flow
      if (__DEV__) console.log("[auth-layout] user needs onboarding → staying in auth");
      return;
    }

    // User is fully onboarded - check if they've seen welcome screen
    if (isCheckingWelcome) return;

    void (async () => {
      setIsCheckingWelcome(true);
      try {
        const seenWelcome = await hasSeenWelcome(user.id);
        if (!seenWelcome) {
          if (__DEV__) console.log("[auth-layout] user onboarded but hasn't seen welcome → redirecting to welcome");
          router.replace("/(auth)/welcome");
        } else {
          if (__DEV__) console.log("[auth-layout] user fully onboarded → redirecting to tabs");
          router.replace("/(tabs)");
        }
      } catch (error) {
        console.error("[auth-layout] error checking welcome status", error);
        // On error, assume welcome not seen and redirect to welcome
        router.replace("/(auth)/welcome");
      } finally {
        setIsCheckingWelcome(false);
      }
    })();
  }, [isAuthLoading, isProfileLoading, user, isEmailConfirmed, profile, isCheckingWelcome, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}


