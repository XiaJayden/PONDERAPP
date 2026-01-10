"use server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

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

function formatISODateUTC(d: Date): string {
  // daily_prompts.prompt_date is stored as YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

function addDaysToISODate(dateYYYYMMDD: string, days: number): string {
  // Interpret date-only strings as UTC midnight to avoid timezone drift.
  const base = new Date(`${dateYYYYMMDD}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) throw new Error(`Invalid prompt_date: ${dateYYYYMMDD}`);
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return formatISODateUTC(next);
}

export async function reorderPrompts(orderedIds: string[]) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

  const ids = (orderedIds ?? []).map((x) => String(x)).filter(Boolean);
  if (ids.length === 0) return;

  // prompt_date has a UNIQUE constraint, so swapping dates can fail if we update directly.
  // Do a 2-phase update:
  // 1) move affected rows to temporary unique prompt_date + display_order values
  // 2) assign final (baseDate + idx) dates + display_order
  const [
    { data: minDateRows, error: minDateError },
    { data: maxDateRows, error: maxDateError },
    { data: maxOrderRows, error: maxOrderError },
  ] = await Promise.all([
    // Determine queue start date (earliest prompt_date among the prompts being reordered).
    supabaseAdmin
      .from("daily_prompts")
      .select("prompt_date")
      .in("id", ids)
      .order("prompt_date", { ascending: true })
      .limit(1),
    // Determine current max prompt_date overall so we can choose temp dates that can't collide.
    supabaseAdmin.from("daily_prompts").select("prompt_date").order("prompt_date", { ascending: false }).limit(1),
    // Determine max display_order so we can choose temp order values that can't collide.
    supabaseAdmin.from("daily_prompts").select("display_order").order("display_order", { ascending: false }).limit(1),
  ]);
  if (minDateError) throw new Error(minDateError.message);
  if (maxDateError) throw new Error(maxDateError.message);
  if (maxOrderError) throw new Error(maxOrderError.message);

  const baseDate =
    (minDateRows?.[0]?.prompt_date ?? "").trim() || addDaysToISODate(formatISODateUTC(new Date()), 1);

  const maxDate = (maxDateRows?.[0]?.prompt_date ?? "").trim() || formatISODateUTC(new Date());
  // Push temp dates well beyond any real scheduled prompts (10y buffer) to avoid UNIQUE collisions.
  const tempBase = addDaysToISODate(maxDate, 3650);

  const maxOrderRaw = maxOrderRows?.[0]?.display_order ?? null;
  const maxOrder = typeof maxOrderRaw === "number" && Number.isFinite(maxOrderRaw) ? maxOrderRaw : 0;
  // Push temp display_order beyond any real orders to avoid UNIQUE collisions during the swap.
  const tempOrderBase = maxOrder + 1000;

  for (let idx = 0; idx < ids.length; idx++) {
    const id = ids[idx];
    const { error } = await supabaseAdmin
      .from("daily_prompts")
      .update({ prompt_date: addDaysToISODate(tempBase, idx), display_order: tempOrderBase + idx + 1 })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  for (let idx = 0; idx < ids.length; idx++) {
    const id = ids[idx];
    const { error } = await supabaseAdmin
      .from("daily_prompts")
      .update({ display_order: idx + 1, prompt_date: addDaysToISODate(baseDate, idx) })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/dashboard/prompts");
}

export async function createPrompt(formData: FormData) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const prompt_text = String(formData.get("prompt_text") ?? "").trim();
  const explanation_text = normalizeEmpty(formData.get("explanation_text"));
  const theme = normalizeEmpty(formData.get("theme"));

  if (!prompt_text) throw new Error("prompt_text is required");

  // Auto-assign queue position and date:
  // - display_order = max(display_order) + 1 (or 1)
  // - prompt_date = max(prompt_date) + 1 day (or tomorrow)
  const [{ data: maxOrderRows, error: maxOrderError }, { data: maxDateRows, error: maxDateError }] =
    await Promise.all([
      supabaseAdmin
        .from("daily_prompts")
        .select("display_order")
        .order("display_order", { ascending: false, nullsFirst: false })
        .limit(1),
      supabaseAdmin.from("daily_prompts").select("prompt_date").order("prompt_date", { ascending: false }).limit(1),
    ]);
  if (maxOrderError) throw new Error(maxOrderError.message);
  if (maxDateError) throw new Error(maxDateError.message);

  const maxOrder = maxOrderRows?.[0]?.display_order ?? null;
  const display_order = (typeof maxOrder === "number" && Number.isFinite(maxOrder) ? maxOrder : 0) + 1;

  const maxDate = (maxDateRows?.[0]?.prompt_date ?? "").trim();
  const prompt_date = maxDate ? addDaysToISODate(maxDate, 1) : addDaysToISODate(formatISODateUTC(new Date()), 1);

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
  const prompt_date = normalizeEmpty(formData.get("prompt_date"));
  const explanation_text = normalizeEmpty(formData.get("explanation_text"));
  const theme = normalizeEmpty(formData.get("theme"));
  const display_order = normalizeNumber(formData.get("display_order"));

  if (!prompt_text) throw new Error("prompt_text is required");

  const update: Record<string, unknown> = { prompt_text, explanation_text, theme, display_order };
  if (prompt_date) update.prompt_date = prompt_date;

  const { error } = await supabaseAdmin.from("daily_prompts").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/prompts");
  revalidatePath(`/dashboard/prompts/${id}`);
}

export async function deletePromptById(id: string) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const promptId = String(id ?? "").trim();
  if (!promptId) throw new Error("Missing prompt id");

  // Get the queue position before deleting so we can shift subsequent prompts.
  const { data: toDelete, error: toDeleteError } = await supabaseAdmin
    .from("daily_prompts")
    .select("id,display_order,prompt_date")
    .eq("id", promptId)
    .maybeSingle();
  if (toDeleteError) throw new Error(toDeleteError.message);
  if (!toDelete) throw new Error("Prompt not found");

  const { error } = await supabaseAdmin.from("daily_prompts").delete().eq("id", promptId);
  if (error) throw new Error(error.message);

  const deletedOrder = toDelete.display_order;
  const deletedDate = toDelete.prompt_date;

  if (typeof deletedOrder === "number" && Number.isFinite(deletedOrder) && deletedDate) {
    const { data: subsequent, error: subsequentError } = await supabaseAdmin
      .from("daily_prompts")
      .select("id,display_order,prompt_date")
      .gt("display_order", deletedOrder)
      .order("display_order", { ascending: true });
    if (subsequentError) throw new Error(subsequentError.message);

    const updates =
      (subsequent ?? [])
        .filter((p) => p.id != null && typeof p.display_order === "number" && !!p.prompt_date)
        .map((p) => ({
          id: p.id,
          display_order: (p.display_order as number) - 1,
          prompt_date: addDaysToISODate(p.prompt_date as string, -1),
        })) ?? [];

    if (updates.length) {
      // Use update-by-id (not upsert) to avoid any chance of inserting partial rows
      // (daily_prompts has NOT NULL columns like prompt_text).
      for (const u of updates) {
        const { error: shiftError } = await supabaseAdmin
          .from("daily_prompts")
          .update({ display_order: u.display_order, prompt_date: u.prompt_date })
          .eq("id", u.id);
        if (shiftError) throw new Error(shiftError.message);
      }
    }
  }

  revalidatePath("/dashboard/prompts");
  revalidatePath(`/dashboard/prompts/${promptId}`);
}

export async function deletePrompt(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  return deletePromptById(id);
}


