import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

function readSupabaseUrl(): string | null {
  return (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    null
  );
}

function readServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

let cached: SupabaseClient<Database> | null = null;

export function getSupabaseAdmin() {
  const url = readSupabaseUrl();
  const key = readServiceRoleKey();
  if (!url || !key) return null;
  if (cached) return cached;
  cached = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}



