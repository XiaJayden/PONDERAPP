import { getSupabaseAdmin } from "@/lib/supabase-admin";

function isoSince(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

async function distinctUsersFromEventsSince(sinceIso: string) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return 0;
  const { data, error } = await supabaseAdmin
    .from("user_events")
    .select("user_id")
    .gte("created_at", sinceIso)
    .not("user_id", "is", null)
    .limit(50000);

  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const row of (data ?? []) as Array<{ user_id: string }>) {
    const id = row.user_id;
    if (typeof id === "string" && id) set.add(id);
  }
  return set.size;
}

export default async function PerformancePage() {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
        Missing env vars. Set <code className="rounded bg-white/10 px-1 py-0.5">SUPABASE_URL</code> and{" "}
        <code className="rounded bg-white/10 px-1 py-0.5">SUPABASE_SERVICE_ROLE_KEY</code>.
      </div>
    );
  }

  let totalUsers: number | null = null;
  try {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if ("total" in data) {
      const t = (data as unknown as { total?: unknown }).total;
      totalUsers = typeof t === "number" ? t : null;
    } else {
      totalUsers = null;
    }
  } catch {
    // Some Supabase setups disable admin endpoints; keep page usable.
    totalUsers = null;
  }

  const [dau, wau, mau] = await Promise.all([
    distinctUsersFromEventsSince(isoSince(1)),
    distinctUsersFromEventsSince(isoSince(7)),
    distinctUsersFromEventsSince(isoSince(30)),
  ]);

  const [{ count: promptCount }, { count: eventCount7d }, latestPrompts] = await Promise.all([
    supabaseAdmin.from("daily_prompts").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("user_events").select("id", { count: "exact", head: true }).gte("created_at", isoSince(7)),
    supabaseAdmin
      .from("daily_prompts")
      .select("id,prompt_date,prompt_text")
      .order("prompt_date", { ascending: false })
      .limit(10),
  ]);

  const prompts = (latestPrompts.data ?? []) as Array<{ id: string | number; prompt_date: string; prompt_text: string }>;

  const responseCounts = await Promise.all(
    prompts.map(async (p) => {
      const { count } = await supabaseAdmin
        .from("yim_posts")
        .select("id", { count: "exact", head: true })
        .eq("prompt_id", p.id);
      return { promptId: String(p.id), prompt_date: p.prompt_date, prompt_text: p.prompt_text, posts: count ?? 0 };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Performance</h1>
        <p className="mt-1 text-sm text-white/60">High-level product + usage metrics for alpha testing.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Total users</div>
          <div className="mt-1 text-2xl font-semibold">{totalUsers ?? "—"}</div>
          <div className="mt-2 text-xs text-white/50">From auth admin API (service role).</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">DAU</div>
          <div className="mt-1 text-2xl font-semibold">{dau}</div>
          <div className="mt-2 text-xs text-white/50">Distinct users with events in last 24h.</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">WAU</div>
          <div className="mt-1 text-2xl font-semibold">{wau}</div>
          <div className="mt-2 text-xs text-white/50">Distinct users with events in last 7d.</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">MAU</div>
          <div className="mt-1 text-2xl font-semibold">{mau}</div>
          <div className="mt-2 text-xs text-white/50">Distinct users with events in last 30d.</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Prompts in DB</div>
          <div className="mt-1 text-2xl font-semibold">{promptCount ?? "—"}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Events (7d)</div>
          <div className="mt-1 text-2xl font-semibold">{eventCount7d ?? "—"}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">Notes</div>
          <div className="mt-1 text-sm text-white/70">
            Response “rate” below is total posts per prompt (not distinct users).
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="bg-white/5 px-4 py-3 text-sm font-medium">Latest prompt responses</div>
        <div className="divide-y divide-white/10">
          {responseCounts.length === 0 ? (
            <div className="px-4 py-6 text-sm text-white/60">No prompts found.</div>
          ) : (
            responseCounts.map((r) => (
              <div key={r.promptId} className="px-4 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">{r.prompt_date}</span>
                  <span className="text-white/50">posts={r.posts}</span>
                </div>
                <div className="mt-1 text-sm text-white/80">{r.prompt_text}</div>
                <div className="mt-1 text-xs text-white/60">prompt_id={r.promptId}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


