import { createClient } from "@supabase/supabase-js";

import { secureStoreAdapter } from "./secure-store";

/**
 * Supabase client for React Native (Expo).
 *
 * Env vars:
 * - EXPO_PUBLIC_SUPABASE_URL
 * - EXPO_PUBLIC_SUPABASE_ANON_KEY
 *
 * Debugging:
 * - If these are missing, we log loudly and throw in dev so it fails fast.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    !supabaseUrl ? "EXPO_PUBLIC_SUPABASE_URL" : null,
    !supabaseAnonKey ? "EXPO_PUBLIC_SUPABASE_ANON_KEY" : null,
  ].filter(Boolean);

  // eslint-disable-next-line no-console
  console.error(
    `[supabase] Missing required environment variables: ${missing.join(", ")}.\n` +
      `Add them to a local .env file (not committed) and restart Expo.\n` +
      `Example:\n` +
      `EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co\n` +
      `EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`
  );

  if (__DEV__) {
    throw new Error(`[supabase] Missing env vars: ${missing.join(", ")}`);
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  // In prod, we still want a hard failure rather than silent undefined behavior.
  throw new Error("[supabase] Configuration incomplete. Cannot create client.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist sessions securely on-device (Keychain on iOS).
    storage: secureStoreAdapter,
    persistSession: true,
    autoRefreshToken: true,

    // RN apps don’t handle auth redirects via URL fragments like web.
    detectSessionInUrl: false,
  },
});


