import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';

import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { router } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/hooks/useProfile';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { useEventTracking } from '@/hooks/useEventTracking';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, isLoading: isAuthLoading, isEmailConfirmed } = useAuth();
  const { profile, isLoading: isProfileLoading } = useProfile();
  const { trackEvent } = useEventTracking();

  // Track app open when user successfully loads the app
  useEffect(() => {
    if (!isAuthLoading && !isProfileLoading && user && isEmailConfirmed && profile?.onboarding_complete) {
      void trackEvent({
        event_type: "app_open",
        event_name: "app_open",
        metadata: {},
      });
    }
  }, [isAuthLoading, isProfileLoading, user, isEmailConfirmed, profile?.onboarding_complete, trackEvent]);

  useEffect(() => {
    if (__DEV__) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[tabs-layout] 🔍 CHECKING AUTH STATE");
      console.log("  isAuthLoading:", isAuthLoading);
      console.log("  isProfileLoading:", isProfileLoading);
      console.log("  hasUser:", !!user);
      console.log("  userId:", user?.id);
      console.log("  userEmail:", user?.email);
      console.log("  isEmailConfirmed:", isEmailConfirmed);
      console.log("  hasProfile:", !!profile);
      console.log("  profile?.onboarding_complete:", profile?.onboarding_complete);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    if (isAuthLoading) {
      if (__DEV__) console.log("[tabs-layout] ⏳ Still loading auth, waiting...");
      return;
    }
    
    // No user at all - redirect to login
    if (!user) {
      if (__DEV__) console.log("[tabs-layout] 👤 No user → redirecting to /(auth)/login");
      router.replace("/(auth)/login");
      return;
    }

    // User exists but email not confirmed - redirect to login
    // (they'll see the verification popup there)
    if (!isEmailConfirmed) {
      if (__DEV__) console.log("[tabs-layout] 📧 Email NOT confirmed → redirecting to /(auth)/login");
      router.replace("/(auth)/login");
      return;
    }

    if (isProfileLoading) {
      if (__DEV__) console.log("[tabs-layout] ⏳ Still loading profile, waiting...");
      return;
    }

    const needsOnboarding =
      !profile ||
      !profile.onboarding_complete ||
      !profile.first_name ||
      !profile.username ||
      !profile.birthday;

    if (needsOnboarding) {
      if (__DEV__) console.log("[tabs-layout] 📝 Needs onboarding → redirecting to /(auth)/onboarding", { hasProfile: !!profile });
      router.replace("/(auth)/onboarding");
    } else {
      if (__DEV__) console.log("[tabs-layout] ✅ User fully authenticated and onboarded, staying in tabs");
    }
  }, [isAuthLoading, isProfileLoading, profile, user, isEmailConfirmed]);

  return (
    <Tabs
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{
        headerShown: false,
        // We render our own tab bar.
        tabBarStyle: { display: "none" },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
        }}
      />

      <Tabs.Screen
        name="create"
        options={{
          title: "Create",
          // Hide default tab button; we render the floating center button ourselves.
          tabBarButton: () => null,
        }}
      />

      <Tabs.Screen
        name="gallery"
        options={{
          title: "Gallery",
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />
    </Tabs>
  );
}
