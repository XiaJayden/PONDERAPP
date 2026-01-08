"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function normalizeEmpty(v: FormDataEntryValue | null): string | null {
  const s = v === null ? "" : String(v).trim();
  return s.length ? s : null;
}

function normalizeNumber(v: FormDataEntryValue | null): number | null {
  const s = v === null ? "" : String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function createPrompt(formData: FormData) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const prompt_text = String(formData.get("prompt_text") ?? "").trim();
  const prompt_date = String(formData.get("prompt_date") ?? "").trim();
  const explanation_text = normalizeEmpty(formData.get("explanation_text"));
  const theme = normalizeEmpty(formData.get("theme"));
  const display_order = normalizeNumber(formData.get("display_order"));

  if (!prompt_text) throw new Error("prompt_text is required");
  if (!prompt_date) throw new Error("prompt_date is required");

  const { error } = await supabaseAdmin.from("daily_prompts").insert({
    prompt_text,
    prompt_date,
    explanation_text,
    theme,
    display_order,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/prompts");
}

export async function updatePrompt(formData: FormData) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing prompt id");

  const prompt_text = String(formData.get("prompt_text") ?? "").trim();
  const prompt_date = String(formData.get("prompt_date") ?? "").trim();
  const explanation_text = normalizeEmpty(formData.get("explanation_text"));
  const theme = normalizeEmpty(formData.get("theme"));
  const display_order = normalizeNumber(formData.get("display_order"));

  if (!prompt_text) throw new Error("prompt_text is required");
  if (!prompt_date) throw new Error("prompt_date is required");

  const { error } = await supabaseAdmin
    .from("daily_prompts")
    .update({ prompt_text, prompt_date, explanation_text, theme, display_order })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/prompts");
  revalidatePath(`/dashboard/prompts/${id}`);
}

export async function deletePrompt(formData: FormData) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing prompt id");

  const { error } = await supabaseAdmin.from("daily_prompts").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/prompts");
}


