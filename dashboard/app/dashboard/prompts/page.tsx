import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createPrompt, deletePrompt } from "./actions";

type PromptRow = {
  id: string | number;
  prompt_text: string;
  explanation_text: string | null;
  prompt_date: string;
  theme: string | null;
  display_order: number | null;
  created_at?: string;
};

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
    .order("prompt_date", { ascending: false })
    .limit(200);

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
          <label className="text-sm">
            <div className="text-xs text-white/60">Prompt date (YYYY-MM-DD)</div>
            <input
              name="prompt_date"
              type="date"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
              required
            />
          </label>
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
          <label className="text-sm">
            <div className="text-xs text-white/60">Display order (optional)</div>
            <input
              name="display_order"
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
            />
          </label>
          <div className="md:col-span-2">
            <button className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black">Create</button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="bg-white/5 px-4 py-3 text-sm font-medium">Existing prompts</div>
        <div className="divide-y divide-white/10">
          {prompts.length === 0 ? (
            <div className="px-4 py-6 text-sm text-white/60">No prompts found.</div>
          ) : (
            prompts.map((p) => (
              <div key={String(p.id)} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{p.prompt_text}</div>
                  <div className="mt-1 text-xs text-white/60">
                    id={String(p.id)} • date={p.prompt_date} • order={p.display_order ?? "—"} • theme={p.theme ?? "—"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/dashboard/prompts/${encodeURIComponent(String(p.id))}`}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                  >
                    Edit + Preview
                  </Link>
                  <form action={deletePrompt}>
                    <input type="hidden" name="id" value={String(p.id)} />
                    <button className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/15">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


