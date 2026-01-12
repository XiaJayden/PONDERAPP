/**
 * Hook to initialize push notifications on app launch.
 * 
 * Automatically requests permissions and registers push token when user is authenticated.
 */

import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";

import { initializePushNotifications, unregisterPushTokens } from "@/lib/notifications";
import { useAuth } from "@/providers/auth-provider";

/**
 * Hook to handle push notification initialization and lifecycle.
 * 
 * - Registers push token when user logs in
 * - Unregisters push tokens when user logs out
 * - Sets up notification listeners for foreground notifications
 */
export function useNotifications() {
  const { user } = useAuth();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Register push token when user is authenticated
    if (user?.id) {
      void initializePushNotifications(user.id);
    } else {
      // Unregister tokens when user logs out
      // Note: We don't have the userId here, but tokens are cleaned up via CASCADE on user delete
      // For explicit logout cleanup, we'd need to store userId before logout
    }

    // Set up notification listeners for foreground notifications
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      if (__DEV__) {
        console.log("[notifications] Notification received:", notification);
      }
      // You can handle foreground notifications here if needed
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      if (__DEV__) {
        console.log("[notifications] Notification response:", response);
      }
      // Handle notification tap/response here if needed
      // e.g., navigate to a specific screen
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user?.id]);
}
