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
    if (__DEV__) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[auth-layout] 🔍 CHECKING AUTH STATE");
      console.log("  isAuthLoading:", isAuthLoading);
      console.log("  isProfileLoading:", isProfileLoading);
      console.log("  hasUser:", !!user);
      console.log("  userId:", user?.id);
      console.log("  userEmail:", user?.email);
      console.log("  isEmailConfirmed:", isEmailConfirmed);
      console.log("  hasProfile:", !!profile);
      console.log("  profile?.onboarding_complete:", profile?.onboarding_complete);
      console.log("  profile?.first_name:", profile?.first_name);
      console.log("  profile?.username:", profile?.username);
      console.log("  profile?.birthday:", profile?.birthday);
      console.log("  segments:", segments);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    if (isAuthLoading) {
      if (__DEV__) console.log("[auth-layout] ⏳ Still loading auth, waiting...");
      return;
    }
    
    // No user - stay in auth flow
    if (!user) {
      if (__DEV__) console.log("[auth-layout] 👤 No user → staying in auth flow");
      return;
    }

    // Email not confirmed - stay in auth flow (login screen shows verification popup)
    if (!isEmailConfirmed) {
      if (__DEV__) console.log("[auth-layout] 📧 Email NOT confirmed → staying in auth flow");
      return;
    }

    // Wait for profile to load before deciding
    if (isProfileLoading) {
      if (__DEV__) console.log("[auth-layout] ⏳ Still loading profile, waiting...");
      return;
    }

    // Check if we're already on the welcome screen - don't redirect away from it
    // segments could be ["(auth)", "welcome"] or ["welcome"] depending on route structure
    const isOnWelcomeScreen = segments.some((seg) => seg === "welcome" || seg.includes("welcome"));
    if (isOnWelcomeScreen) {
      if (__DEV__) console.log("[auth-layout] 👋 Already on welcome screen → staying", { segments });
      return;
    }

    // Check if onboarding is complete
    const onboardingComplete = 
      profile?.onboarding_complete &&
      profile?.first_name &&
      profile?.username &&
      profile?.birthday;

    if (!onboardingComplete) {
      // User needs onboarding - redirect to onboarding screen if not already there
      const isOnOnboardingScreen = segments.some((seg) => seg === "onboarding" || seg.includes("onboarding"));
      if (!isOnOnboardingScreen) {
        if (__DEV__) console.log("[auth-layout] 📝 User needs onboarding → redirecting to /(auth)/onboarding");
        router.replace("/(auth)/onboarding");
      } else {
        if (__DEV__) console.log("[auth-layout] 📝 User needs onboarding, already on onboarding screen");
      }
      return;
    }

    // User is fully onboarded - check if they've seen welcome screen
    if (isCheckingWelcome) {
      if (__DEV__) console.log("[auth-layout] ⏳ Already checking welcome status, waiting...");
      return;
    }

    void (async () => {
      setIsCheckingWelcome(true);
      try {
        const seenWelcome = await hasSeenWelcome(user.id);
        if (!seenWelcome) {
          if (__DEV__) console.log("[auth-layout] 👋 User onboarded but hasn't seen welcome → redirecting to welcome");
          router.replace("/(auth)/welcome");
        } else {
          if (__DEV__) console.log("[auth-layout] ✅ User fully onboarded → redirecting to (tabs)");
          router.replace("/(tabs)");
        }
      } catch (error) {
        console.error("[auth-layout] ❌ Error checking welcome status", error);
        // On error, assume welcome not seen and redirect to welcome
        router.replace("/(auth)/welcome");
      } finally {
        setIsCheckingWelcome(false);
      }
    })();
  }, [isAuthLoading, isProfileLoading, user, isEmailConfirmed, profile, isCheckingWelcome, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}


