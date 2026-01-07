import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';

import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { router } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/hooks/useProfile';
import { BottomNav } from '@/components/navigation/bottom-nav';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { profile, isLoading: isProfileLoading } = useProfile();

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      if (__DEV__) console.log("[tabs-layout] no user → redirecting to login");
      router.replace("/(auth)/login");
      return;
    }

    if (isProfileLoading) return;

    const needsOnboarding =
      !profile ||
      !profile.onboarding_complete ||
      !profile.first_name ||
      !profile.username ||
      !profile.birthday;

    if (needsOnboarding) {
      if (__DEV__) console.log("[tabs-layout] needs onboarding → redirecting", { hasProfile: !!profile });
      router.replace("/(auth)/onboarding");
    }
  }, [isAuthLoading, isProfileLoading, profile, user]);

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
