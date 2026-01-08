import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { updatePrompt } from "../actions";
import { PromptPreview } from "@/components/prompt-preview";

type PromptRow = {
  id: string | number;
  prompt_text: string;
  explanation_text: string | null;
  prompt_date: string;
  theme: string | null;
  display_order: number | null;
};

export default async function PromptDetailPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);

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
    .select("id,prompt_text,explanation_text,prompt_date,theme,display_order")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
        Failed to load prompt: {error.message}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-white/70">Prompt not found.</div>
        <Link className="text-sm underline underline-offset-4" href="/dashboard/prompts">
          Back to prompts
        </Link>
      </div>
    );
  }

  const prompt = data as PromptRow;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Edit prompt</h1>
          <div className="mt-1 text-xs text-white/60">id={String(prompt.id)}</div>
        </div>
        <Link className="text-sm text-white/70 underline underline-offset-4" href="/dashboard/prompts">
          Back
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium">Details</div>
          <form action={updatePrompt} className="mt-3 grid gap-3">
            <input type="hidden" name="id" value={String(prompt.id)} />
            <label className="text-sm">
              <div className="text-xs text-white/60">Prompt text</div>
              <input
                name="prompt_text"
                defaultValue={prompt.prompt_text}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
                required
              />
            </label>
            <label className="text-sm">
              <div className="text-xs text-white/60">Prompt date (YYYY-MM-DD)</div>
              <input
                name="prompt_date"
                type="date"
                defaultValue={prompt.prompt_date}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
                required
              />
            </label>
            <label className="text-sm">
              <div className="text-xs text-white/60">Explanation (optional)</div>
              <textarea
                name="explanation_text"
                rows={4}
                defaultValue={prompt.explanation_text ?? ""}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
              />
            </label>
            <label className="text-sm">
              <div className="text-xs text-white/60">Theme (optional)</div>
              <input
                name="theme"
                defaultValue={prompt.theme ?? ""}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
              />
            </label>
            <label className="text-sm">
              <div className="text-xs text-white/60">Display order (optional)</div>
              <input
                name="display_order"
                inputMode="numeric"
                defaultValue={prompt.display_order ?? ""}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
              />
            </label>
            <div>
              <button className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black">Save</button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium">Preview</div>
          <div className="mt-3">
            <PromptPreview
              prompt={{
                id: String(prompt.id),
                prompt_text: prompt.prompt_text,
                explanation_text: prompt.explanation_text,
                prompt_date: prompt.prompt_date,
                theme: prompt.theme,
                display_order: prompt.display_order,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


