import { getSupabaseAdmin } from "@/lib/supabase-admin";

type UserEventRow = {
  id: string;
  user_id: string | null;
  event_type: string;
  event_name: string;
  metadata: unknown;
  created_at: string;
};

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export default async function ImplicitMetricsPage({
  searchParams,
}: {
  searchParams: { user_id?: string; event_type?: string; event_name?: string; days?: string };
}) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
        Missing env vars. Set <code className="rounded bg-white/10 px-1 py-0.5">SUPABASE_URL</code> and{" "}
        <code className="rounded bg-white/10 px-1 py-0.5">SUPABASE_SERVICE_ROLE_KEY</code>.
      </div>
    );
  }

  const user_id = (searchParams.user_id ?? "").trim();
  const event_type = (searchParams.event_type ?? "").trim();
  const event_name = (searchParams.event_name ?? "").trim();
  const days = Math.max(1, Math.min(90, Number(searchParams.days ?? "7") || 7));

  const since = isoDaysAgo(days);

  let q = supabaseAdmin
    .from("user_events")
    .select("id,user_id,event_type,event_name,metadata,created_at", { count: "exact" })
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  if (user_id) q = q.eq("user_id", user_id);
  if (event_type) q = q.eq("event_type", event_type);
  if (event_name) q = q.eq("event_name", event_name);

  const { data, error, count } = await q;
  const events = (data ?? []) as UserEventRow[];

  const byName = new Map<string, number>();
  for (const e of events) byName.set(e.event_name, (byName.get(e.event_name) ?? 0) + 1);
  const topNames = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Implicit Metrics</h1>
        <p className="mt-1 text-sm text-white/60">Browse raw events (button presses, screen views, sessions, etc.).</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-medium">Filters</div>
        <form method="get" className="mt-3 grid gap-3 md:grid-cols-4">
          <label className="text-sm">
            <div className="text-xs text-white/60">User ID</div>
            <input
              name="user_id"
              defaultValue={user_id}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
              placeholder="uuid"
            />
          </label>
          <label className="text-sm">
            <div className="text-xs text-white/60">Event type</div>
            <input
              name="event_type"
              defaultValue={event_type}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
              placeholder="button_press"
            />
          </label>
          <label className="text-sm">
            <div className="text-xs text-white/60">Event name</div>
            <input
              name="event_name"
              defaultValue={event_name}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
              placeholder="respond_button"
            />
          </label>
          <label className="text-sm">
            <div className="text-xs text-white/60">Lookback (days)</div>
            <input
              name="days"
              defaultValue={String(days)}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
            />
          </label>
          <div className="md:col-span-4">
            <button className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black">Apply</button>
          </div>
        </form>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
          Failed to load events: {error.message}
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Total matching events (since {days}d)</div>
              <div className="mt-1 text-2xl font-semibold">{count ?? "—"}</div>
              <div className="mt-2 text-xs text-white/50">Showing latest {events.length} rows.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 lg:col-span-2">
              <div className="text-sm font-medium">Most common (in current results)</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {topNames.length === 0 ? (
                  <div className="text-sm text-white/60">No events.</div>
                ) : (
                  topNames.map(([name, n]) => (
                    <div key={name} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="truncate text-sm">{name}</div>
                      <div className="text-xs text-white/60">{n}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="bg-white/5 px-4 py-3 text-sm font-medium">Latest events</div>
            <div className="divide-y divide-white/10">
              {events.length === 0 ? (
                <div className="px-4 py-6 text-sm text-white/60">No events found.</div>
              ) : (
                events.map((e) => (
                  <div key={e.id} className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-medium">{e.event_name}</span>
                      <span className="text-white/50">{e.event_type}</span>
                      <span className="text-white/50">{e.created_at}</span>
                    </div>
                    <div className="mt-1 text-xs text-white/60">user_id={e.user_id ?? "—"}</div>
                    {e.metadata ? (
                      <pre className="mt-2 max-h-48 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/70">
                        {JSON.stringify(e.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


