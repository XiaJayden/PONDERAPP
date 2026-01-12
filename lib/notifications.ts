/**
 * Push notification token registration and permission handling.
 * 
 * Handles:
 * - Requesting notification permissions
 * - Getting Expo push tokens
 * - Registering tokens with Supabase
 */

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "./supabase";

// Configure notification handler behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions from the user.
 * Returns true if permission is granted, false otherwise.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.warn("[notifications] Not a physical device, skipping permission request");
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[notifications] Permission not granted:", finalStatus);
    return false;
  }

  return true;
}

/**
 * Get the Expo push token for this device.
 * Requires notification permissions to be granted.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("[notifications] Not a physical device, cannot get push token");
    return null;
  }

  try {
    // Get project ID from expo-constants (works in both dev and production)
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    
    if (!projectId) {
      console.warn("[notifications] No project ID found, cannot get push token");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return tokenData.data;
  } catch (error) {
    console.error("[notifications] Failed to get Expo push token:", error);
    return null;
  }
}

/**
 * Register a push token with Supabase for the current user.
 * Upserts the token (updates if exists, inserts if new).
 */
export async function registerPushToken(userId: string, expoPushToken: string): Promise<void> {
  const platform = Platform.OS === "ios" ? "ios" : "android";

  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: userId,
      expo_push_token: expoPushToken,
      platform,
    },
    {
      onConflict: "user_id,expo_push_token",
    }
  );

  if (error) {
    console.error("[notifications] Failed to register push token:", error);
    throw error;
  }

  if (__DEV__) {
    console.log("[notifications] Successfully registered push token for user:", userId);
  }
}

/**
 * Unregister push tokens for a user (e.g., on logout).
 */
export async function unregisterPushTokens(userId: string): Promise<void> {
  const { error } = await supabase.from("push_tokens").delete().eq("user_id", userId);

  if (error) {
    console.error("[notifications] Failed to unregister push tokens:", error);
    throw error;
  }

  if (__DEV__) {
    console.log("[notifications] Successfully unregistered push tokens for user:", userId);
  }
}

/**
 * Initialize push notifications: request permissions and register token.
 * Call this after user authentication.
 */
export async function initializePushNotifications(userId: string): Promise<void> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.warn("[notifications] Permission denied, skipping token registration");
    return;
  }

  const token = await getExpoPushToken();
  if (!token) {
    console.warn("[notifications] Could not get push token");
    return;
  }

  await registerPushToken(userId, token);
}
