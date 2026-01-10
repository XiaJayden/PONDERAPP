import * as SecureStore from "expo-secure-store";

/**
 * Daily prompt persistence for native.
 *
 * Web used `localStorage`. On iOS we store small “state flags” in SecureStore:
 * - prompt opened time (starts the 30-minute window)
 * - prompt popup shown flag (don’t annoy user repeatedly)
 *
 * NOTE: This is not ultra-sensitive data, but SecureStore is already in use for Supabase sessions,
 * and keeps behavior consistent across iOS/Android.
 */

function getPromptOpenedKey(params: { userId: string; promptId: string; promptDate: string }) {
  return `prompt_opened_${params.promptId}_${params.userId}_${params.promptDate}`;
}

function getPromptPopupShownKey(params: { userId: string; promptId: string; dateKey: string }) {
  return `prompt_popup_shown_${params.userId}_${params.promptId}_${params.dateKey}`;
}

function getDevRespondedOverrideKey(params: { userId: string; promptId: string; promptDate: string }) {
  return `dev_prompt_responded_override_${params.promptId}_${params.userId}_${params.promptDate}`;
}

export async function getUserPromptOpenTime(params: { userId: string; promptId: string; promptDate: string }) {
  const key = getPromptOpenedKey(params);
  try {
    const stored = await SecureStore.getItemAsync(key);
    if (!stored) return null;
    const parsed = new Date(stored);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  } catch (error) {
    console.warn("[prompt-store] getUserPromptOpenTime failed", { key, error });
    return null;
  }
}

export async function setUserPromptOpenTime(params: { userId: string; promptId: string; promptDate: string }) {
  const key = getPromptOpenedKey(params);
  try {
    await SecureStore.setItemAsync(key, new Date().toISOString(), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
    if (__DEV__) console.log("[prompt-store] setUserPromptOpenTime", { key });
  } catch (error) {
    console.warn("[prompt-store] setUserPromptOpenTime failed", { key, error });
  }
}

export async function clearUserPromptOpenTime(params: { userId: string; promptId: string; promptDate: string }) {
  const key = getPromptOpenedKey(params);
  try {
    await SecureStore.deleteItemAsync(key);
    if (__DEV__) console.log("[prompt-store] clearUserPromptOpenTime", { key });
  } catch (error) {
    console.warn("[prompt-store] clearUserPromptOpenTime failed", { key, error });
  }
}

export async function wasPromptPopupShown(params: { userId: string; promptId: string; dateKey: string }) {
  const key = getPromptPopupShownKey(params);
  try {
    const stored = await SecureStore.getItemAsync(key);
    return stored === "true";
  } catch (error) {
    console.warn("[prompt-store] wasPromptPopupShown failed", { key, error });
    return false;
  }
}

export async function markPromptPopupShown(params: { userId: string; promptId: string; dateKey: string }) {
  const key = getPromptPopupShownKey(params);
  try {
    await SecureStore.setItemAsync(key, "true", { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
    if (__DEV__) console.log("[prompt-store] markPromptPopupShown", { key });
  } catch (error) {
    console.warn("[prompt-store] markPromptPopupShown failed", { key, error });
  }
}

export async function clearPromptPopupShown(params: { userId: string; promptId: string; dateKey: string }) {
  const key = getPromptPopupShownKey(params);
  try {
    await SecureStore.deleteItemAsync(key);
    if (__DEV__) console.log("[prompt-store] clearPromptPopupShown", { key });
  } catch (error) {
    console.warn("[prompt-store] clearPromptPopupShown failed", { key, error });
  }
}

/**
 * Dev-only override to simulate "answered today" without needing to delete DB rows.
 * Used by the simplified dev "Reset Cycle" button.
 */
export async function getDevHasRespondedOverride(params: { userId: string; promptId: string; promptDate: string }) {
  const key = getDevRespondedOverrideKey(params);
  try {
    const stored = await SecureStore.getItemAsync(key);
    if (stored === "true") return true;
    if (stored === "false") return false;
    return null;
  } catch (error) {
    console.warn("[prompt-store] getDevHasRespondedOverride failed", { key, error });
    return null;
  }
}

export async function setDevHasRespondedOverride(params: { userId: string; promptId: string; promptDate: string; value: boolean }) {
  const key = getDevRespondedOverrideKey(params);
  try {
    await SecureStore.setItemAsync(key, params.value ? "true" : "false", {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
    if (__DEV__) console.log("[prompt-store] setDevHasRespondedOverride", { key, value: params.value });
  } catch (error) {
    console.warn("[prompt-store] setDevHasRespondedOverride failed", { key, error });
  }
}

export async function clearDevHasRespondedOverride(params: { userId: string; promptId: string; promptDate: string }) {
  const key = getDevRespondedOverrideKey(params);
  try {
    await SecureStore.deleteItemAsync(key);
    if (__DEV__) console.log("[prompt-store] clearDevHasRespondedOverride", { key });
  } catch (error) {
    console.warn("[prompt-store] clearDevHasRespondedOverride failed", { key, error });
  }
}






