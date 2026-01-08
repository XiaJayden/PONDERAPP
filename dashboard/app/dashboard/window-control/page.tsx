import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { clearDevPromptOverrides, setDevPromptOverride } from "./actions";

type OverrideRow = {
  id: string;
  user_id: string;
  force_open: boolean;
  force_closed: boolean;
  expires_at: string | null;
  created_at: string;
};

export default async function WindowControlPage() {
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
    .from("dev_prompt_overrides")
    .select("id,user_id,force_open,force_closed,expires_at,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const overrides = (data ?? []) as OverrideRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Window Control</h1>
        <p className="mt-1 text-sm text-white/60">
          Force the prompt response window open/closed for a specific user (useful for testing edge cases).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium">Set override</div>
          <form action={setDevPromptOverride} className="mt-3 grid gap-3">
            <label className="text-sm">
              <div className="text-xs text-white/60">User ID</div>
              <input
                name="user_id"
                placeholder="uuid from auth.users"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
                required
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <div className="text-xs text-white/60">Mode</div>
                <select
                  name="mode"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
                  defaultValue="open"
                >
                  <option value="open">Force open</option>
                  <option value="close">Force closed</option>
                </select>
              </label>

              <label className="text-sm">
                <div className="text-xs text-white/60">Duration (minutes)</div>
                <input
                  name="minutes"
                  defaultValue="30"
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black">Apply</button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium">Clear overrides</div>
          <form action={clearDevPromptOverrides} className="mt-3 grid gap-3">
            <label className="text-sm">
              <div className="text-xs text-white/60">User ID</div>
              <input
                name="user_id"
                placeholder="uuid"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
                required
              />
            </label>
            <button className="w-fit rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10">
              Clear
            </button>
            <div className="text-xs text-white/60">Deletes all override rows for the user.</div>
          </form>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="bg-white/5 px-4 py-3 text-sm font-medium">Recent overrides</div>
        {error ? (
          <div className="px-4 py-4 text-sm text-red-200">Failed to load overrides: {error.message}</div>
        ) : overrides.length === 0 ? (
          <div className="px-4 py-6 text-sm text-white/60">No overrides yet.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {overrides.map((o) => (
              <div key={o.id} className="px-4 py-4 text-sm">
                <div className="font-medium">{o.user_id}</div>
                <div className="mt-1 text-xs text-white/60">
                  {o.force_open ? "force_open" : o.force_closed ? "force_closed" : "none"} • expires_at=
                  {o.expires_at ?? "—"} • created_at={o.created_at}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


