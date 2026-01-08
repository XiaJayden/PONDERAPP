"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function parseMinutes(v: FormDataEntryValue | null): number {
  const raw = String(v ?? "").trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.min(Math.floor(n), 24 * 60);
}

export async function setDevPromptOverride(formData: FormData) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const user_id = String(formData.get("user_id") ?? "").trim();
  const mode = String(formData.get("mode") ?? "open").trim(); // open|close
  const minutes = parseMinutes(formData.get("minutes"));

  if (!user_id) throw new Error("user_id is required");

  const now = new Date();
  const expires_at = new Date(now.getTime() + minutes * 60 * 1000).toISOString();

  const force_open = mode === "open";
  const force_closed = mode === "close";

  const { error } = await supabaseAdmin.from("dev_prompt_overrides").insert({
    user_id,
    force_open,
    force_closed,
    expires_at,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/window-control");
}

export async function clearDevPromptOverrides(formData: FormData) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const user_id = String(formData.get("user_id") ?? "").trim();
  if (!user_id) throw new Error("user_id is required");

  const { error } = await supabaseAdmin.from("dev_prompt_overrides").delete().eq("user_id", user_id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/window-control");
}


