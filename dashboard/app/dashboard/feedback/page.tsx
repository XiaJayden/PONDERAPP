import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Disable caching - always fetch fresh data
export const dynamic = "force-dynamic";

type FeedbackRow = {
  id: string;
  user_id: string | null;
  feedback_date: string;
  rating: number | null;
  responses: {
    notes?: string;
    rating?: number;
    feedbackDate?: string;
  } | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

function isoDateDaysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function RatingStars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-white/40">No rating</span>;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={n <= rating ? "text-lime-400" : "text-white/20"}
        >
          ★
        </span>
      ))}
      <span className="ml-2 text-sm text-white/60">({rating}/5)</span>
    </div>
  );
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: { days?: string };
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

  const days = Math.max(1, Math.min(180, Number(searchParams.days ?? "30") || 30));
  const sinceDate = isoDateDaysAgo(days);

  // Fetch feedback
  const { data: feedbackData, error, count } = await supabaseAdmin
    .from("user_feedback")
    .select("id,user_id,feedback_date,rating,responses,created_at", { count: "exact" })
    .gte("feedback_date", sinceDate)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (feedbackData ?? []) as FeedbackRow[];

  // Fetch profiles for all user IDs
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
  const profilesMap: Map<string, string | null> = new Map();

  if (userIds.length > 0) {
    const { data: profilesData } = await supabaseAdmin
      .from("profiles")
      .select("id,display_name")
      .in("id", userIds);

    if (profilesData) {
      for (const p of profilesData as ProfileRow[]) {
        profilesMap.set(p.id, p.display_name);
      }
    }
  }

  // Calculate stats
  const ratingsWithValue = rows.filter((r) => typeof r.rating === "number");
  const avgRating = ratingsWithValue.length === 0
    ? null
    : ratingsWithValue.reduce((acc, r) => acc + (r.rating ?? 0), 0) / ratingsWithValue.length;

  const ratingDistribution = [1, 2, 3, 4, 5].map((n) => ({
    rating: n,
    count: rows.filter((r) => r.rating === n).length,
  }));

  const feedbackWithNotes = rows.filter((r) => {
    const responses = r.responses as { notes?: string } | null;
    return responses?.notes && responses.notes.trim().length > 0;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Daily Feedback</h1>
        <p className="mt-1 text-sm text-white/60">
          User feedback submissions from the profile page.
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <form method="get" className="flex items-end gap-4">
          <label className="text-sm">
            <div className="text-xs text-white/60">Lookback (days)</div>
            <input
              name="days"
              defaultValue={String(days)}
              inputMode="numeric"
              className="mt-1 w-24 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/25"
            />
          </label>
          <button className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black">
            Apply
          </button>
        </form>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
          Failed to load feedback: {error.message}
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Total Submissions</div>
              <div className="mt-1 text-2xl font-semibold">{count ?? 0}</div>
              <div className="mt-1 text-xs text-white/40">since {sinceDate}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Average Rating</div>
              <div className="mt-1 text-2xl font-semibold">
                {avgRating === null ? "—" : avgRating.toFixed(1)}
              </div>
              <div className="mt-1 text-xs text-white/40">
                from {ratingsWithValue.length} rated submissions
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">With Notes</div>
              <div className="mt-1 text-2xl font-semibold">{feedbackWithNotes.length}</div>
              <div className="mt-1 text-xs text-white/40">submissions with comments</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Rating Distribution</div>
              <div className="mt-2 flex items-end gap-1">
                {ratingDistribution.map((d) => (
                  <div key={d.rating} className="flex flex-col items-center">
                    <div
                      className="w-6 rounded-t bg-lime-400/80"
                      style={{ height: Math.max(4, d.count * 8) }}
                    />
                    <div className="mt-1 text-[10px] text-white/60">{d.rating}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feedback List */}
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="flex items-center justify-between bg-white/5 px-4 py-3">
              <div className="text-sm font-medium">Recent Feedback</div>
              <div className="text-xs text-white/50">Showing {rows.length} of {count ?? 0}</div>
            </div>
            <div className="divide-y divide-white/10">
              {rows.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-white/60">
                  No feedback found in the last {days} days.
                </div>
              ) : (
                rows.map((r) => {
                  const responses = r.responses as { notes?: string } | null;
                  const notes = responses?.notes?.trim();
                  const displayName = r.user_id ? profilesMap.get(r.user_id) : null;

                  return (
                    <div key={r.id} className="px-4 py-4 hover:bg-white/[0.02]">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lime-400/20 text-sm font-medium text-lime-400">
                              {displayName ? displayName.charAt(0).toUpperCase() : "?"}
                            </div>
                            <div>
                              <div className="text-sm font-medium">
                                {displayName || "Anonymous User"}
                              </div>
                              <div className="text-xs text-white/50">
                                {r.feedback_date} • {new Date(r.created_at).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>

                          {notes ? (
                            <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                              <div className="text-xs text-white/50 mb-1">Notes:</div>
                              <p className="text-sm text-white/90 whitespace-pre-wrap">{notes}</p>
                            </div>
                          ) : (
                            <div className="mt-3 text-xs text-white/40 italic">No notes provided</div>
                          )}
                        </div>

                        <div className="text-right">
                          <RatingStars rating={r.rating} />
                        </div>
                      </div>

                      <div className="mt-2 text-[10px] text-white/30">
                        user_id: {r.user_id ?? "—"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
