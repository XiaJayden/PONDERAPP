import * as SecureStore from "expo-secure-store";

/**
 * Welcome screen persistence for native.
 *
 * Stores a flag indicating whether the user has seen the welcome screen.
 * Uses SecureStore for consistency with other app state flags.
 */

function getWelcomeSeenKey(userId: string) {
  return `welcome_seen_${userId}`;
}

export async function hasSeenWelcome(userId: string): Promise<boolean> {
  const key = getWelcomeSeenKey(userId);
  try {
    const stored = await SecureStore.getItemAsync(key);
    return stored === "true";
  } catch (error) {
    console.warn("[welcome-store] hasSeenWelcome failed", { key, error });
    return false;
  }
}

export async function markWelcomeSeen(userId: string): Promise<void> {
  const key = getWelcomeSeenKey(userId);
  try {
    await SecureStore.setItemAsync(key, "true", {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
    if (__DEV__) console.log("[welcome-store] markWelcomeSeen", { key });
  } catch (error) {
    console.warn("[welcome-store] markWelcomeSeen failed", { key, error });
  }
}

export async function clearWelcomeSeen(userId: string): Promise<void> {
  const key = getWelcomeSeenKey(userId);
  try {
    await SecureStore.deleteItemAsync(key);
    if (__DEV__) console.log("[welcome-store] clearWelcomeSeen", { key });
  } catch (error) {
    console.warn("[welcome-store] clearWelcomeSeen failed", { key, error });
  }
}
