import * as SecureStore from "expo-secure-store";

/**
 * Supabase storage adapter for React Native (Expo).
 *
 * Why:
 * - `@supabase/supabase-js` defaults to `localStorage` (web-only).
 * - On iOS, we want a durable + secure session store.
 *
 * Notes:
 * - SecureStore is async and backed by Keychain on iOS.
 * - Keep values small (Supabase session payloads are fine).
 */
export const secureStoreAdapter = {
  async getItem(key: string) {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (__DEV__) console.log("[secure-store] getItem", { key, hasValue: !!value });
      return value;
    } catch (error) {
      console.warn("[secure-store] getItem failed", { key, error });
      return null;
    }
  },

  async setItem(key: string, value: string) {
    try {
      // iOS Keychain requires explicit options for best behavior in some contexts.
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
      if (__DEV__) console.log("[secure-store] setItem", { key, length: value.length });
    } catch (error) {
      console.warn("[secure-store] setItem failed", { key, error });
    }
  },

  async removeItem(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
      if (__DEV__) console.log("[secure-store] removeItem", { key });
    } catch (error) {
      console.warn("[secure-store] removeItem failed", { key, error });
    }
  },
};


