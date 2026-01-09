import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createPrompt } from "./actions";
import { PromptListClient, type PromptRow } from "@/components/prompt-list-client";

export default async function PromptsPage() {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
        Missing env vars. Set <code className="rounded bg-white/10 px-1 py-0.5">SUPABASE_URL</code> and{" "}
        <code className="rounded bg-white/10 px-1 py-0.5">SUPABASE_SERVICE_ROLE_KEY</code>.
      </div>
    );
  }

  const { data, error } = await supabaseAdmin
    .from("daily_prompts")
    .select("id,prompt_text,explanation_text,prompt_date,theme,display_order,created_at")
    .order("display_order", { ascending: true })
    .order("prompt_date", { ascending: true })
    .limit(1000);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
        Failed to load prompts: {error.message}
      </div>
    );
  }

  const prompts = (data ?? []) as PromptRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Prompts</h1>
          <p className="mt-1 text-sm text-white/60">Create, edit, delete, and preview prompts.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-medium">Create prompt</div>
        <form action={createPrompt} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <div className="text-xs text-white/60">Prompt text</div>
            <input
              name="prompt_text"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
              required
            />
          </label>
          <div className="text-sm md:col-span-1">
            <div className="text-xs text-white/60">Queue placement</div>
            <div className="mt-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70">
              Auto-assigned (next available date + order)
            </div>
          </div>
          <label className="text-sm md:col-span-2">
            <div className="text-xs text-white/60">Explanation (optional)</div>
            <textarea
              name="explanation_text"
              rows={3}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
            />
          </label>
          <label className="text-sm">
            <div className="text-xs text-white/60">Theme (optional)</div>
            <input
              name="theme"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
            />
          </label>
          <div className="md:col-span-2">
            <button className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black">Create</button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <PromptListClient initialPrompts={prompts} />
      </div>
    </div>
  );
}


