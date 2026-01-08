import { getSupabaseAdmin } from "@/lib/supabase-admin";

type FeedbackRow = {
  id: string;
  user_id: string | null;
  feedback_date: string;
  rating: number | null;
  responses: unknown;
  created_at: string;
};

function isoDateDaysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export default async function ExplicitMetricsPage({
  searchParams,
}: {
  searchParams: { user_id?: string; days?: string };
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
  const days = Math.max(1, Math.min(180, Number(searchParams.days ?? "14") || 14));

  const sinceDate = isoDateDaysAgo(days);

  let q = supabaseAdmin
    .from("user_feedback")
    .select("id,user_id,feedback_date,rating,responses,created_at", { count: "exact" })
    .gte("feedback_date", sinceDate)
    .order("feedback_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (user_id) q = q.eq("user_id", user_id);

  const { data, error, count } = await q;
  const rows = (data ?? []) as FeedbackRow[];

  const avgRating =
    rows.length === 0
      ? null
      : rows.reduce((acc, r) => acc + (typeof r.rating === "number" ? r.rating : 0), 0) /
        Math.max(1, rows.filter((r) => typeof r.rating === "number").length);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Explicit Metrics</h1>
        <p className="mt-1 text-sm text-white/60">Daily feedback submissions (forms, ratings, etc.).</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-medium">Filters</div>
        <form method="get" className="mt-3 grid gap-3 md:grid-cols-3">
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
            <div className="text-xs text-white/60">Lookback (days)</div>
            <input
              name="days"
              defaultValue={String(days)}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
            />
          </label>
          <div className="flex items-end">
            <button className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black">Apply</button>
          </div>
        </form>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
          Failed to load feedback: {error.message}
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Submissions (since {sinceDate})</div>
              <div className="mt-1 text-2xl font-semibold">{count ?? "—"}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Avg rating (current results)</div>
              <div className="mt-1 text-2xl font-semibold">{avgRating === null ? "—" : avgRating.toFixed(2)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Showing latest</div>
              <div className="mt-1 text-2xl font-semibold">{rows.length}</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="bg-white/5 px-4 py-3 text-sm font-medium">Latest feedback</div>
            <div className="divide-y divide-white/10">
              {rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-white/60">No feedback found.</div>
              ) : (
                rows.map((r) => (
                  <div key={r.id} className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-medium">{r.feedback_date}</span>
                      <span className="text-white/50">rating={r.rating ?? "—"}</span>
                      <span className="text-white/50">{r.created_at}</span>
                    </div>
                    <div className="mt-1 text-xs text-white/60">user_id={r.user_id ?? "—"}</div>
                    <pre className="mt-2 max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/70">
                      {JSON.stringify(r.responses ?? {}, null, 2)}
                    </pre>
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


