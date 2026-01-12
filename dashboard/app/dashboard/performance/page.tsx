import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Disable caching - always fetch fresh data
export const dynamic = "force-dynamic";

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

  // KPI Calculations
  const todayIso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const todayStart = `${todayIso}T00:00:00Z`;

  // 1. Prompt Completion Rate: % of active users who submitted a response today
  const [activeUsersToday, usersWhoPostedToday] = await Promise.all([
    supabaseAdmin
      .from("user_events")
      .select("user_id")
      .gte("created_at", todayStart)
      .eq("event_type", "app_open")
      .not("user_id", "is", null),
    supabaseAdmin
      .from("user_events")
      .select("user_id")
      .gte("created_at", todayStart)
      .eq("event_type", "post_submit")
      .not("user_id", "is", null),
  ]);

  const activeUserSet = new Set<string>();
  (activeUsersToday.data ?? []).forEach((row) => {
    if (row.user_id) activeUserSet.add(row.user_id);
  });
  const postedUserSet = new Set<string>();
  (usersWhoPostedToday.data ?? []).forEach((row) => {
    if (row.user_id) postedUserSet.add(row.user_id);
  });

  const promptCompletionRate =
    activeUserSet.size > 0 ? ((postedUserSet.size / activeUserSet.size) * 100).toFixed(1) : "0.0";

  // 2. Response Depth: Average word count from posts
  const { data: postsWithWordCount } = await supabaseAdmin
    .from("yim_posts")
    .select("word_count")
    .not("word_count", "is", null);

  const wordCounts = (postsWithWordCount ?? []).map((p: any) => p.word_count ?? 0).filter((w: number) => w > 0);
  const avgWordCount = wordCounts.length > 0 ? Math.round(wordCounts.reduce((a: number, b: number) => a + b, 0) / wordCounts.length) : 0;
  const medianWordCount =
    wordCounts.length > 0
      ? (() => {
          const sorted = [...wordCounts].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
        })()
      : 0;

  // 3. Lurker Rate: Users who opened app but never posted
  const [allAppOpenUsers, allPostUsers] = await Promise.all([
    supabaseAdmin
      .from("user_events")
      .select("user_id")
      .eq("event_type", "app_open")
      .not("user_id", "is", null),
    supabaseAdmin
      .from("user_events")
      .select("user_id")
      .eq("event_type", "post_submit")
      .not("user_id", "is", null),
  ]);

  const appOpenUserSet = new Set<string>();
  (allAppOpenUsers.data ?? []).forEach((row) => {
    if (row.user_id) appOpenUserSet.add(row.user_id);
  });
  const postUserSet = new Set<string>();
  (allPostUsers.data ?? []).forEach((row) => {
    if (row.user_id) postUserSet.add(row.user_id);
  });

  const lurkers = Array.from(appOpenUserSet).filter((uid) => !postUserSet.has(uid));
  const lurkerRate = appOpenUserSet.size > 0 ? ((lurkers.length / appOpenUserSet.size) * 100).toFixed(1) : "0.0";

  // 4. Social Acknowledgement Rate: Posts with likes / Total posts
  const [{ count: totalPosts }, { count: postsWithLikes }] = await Promise.all([
    supabaseAdmin.from("yim_posts").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("post_likes")
      .select("post_id", { count: "exact", head: true })
      .limit(1),
  ]);

  // Get distinct posts with likes
  const { data: distinctLikedPosts } = await supabaseAdmin.from("post_likes").select("post_id");
  const likedPostSet = new Set<string>();
  (distinctLikedPosts ?? []).forEach((row: any) => {
    if (row.post_id) likedPostSet.add(String(row.post_id));
  });

  const socialAckRate = (totalPosts ?? 0) > 0 ? (((likedPostSet.size / (totalPosts ?? 1)) * 100).toFixed(1)) : "0.0";

  // 5. Explicit Prompt Rating: Average rating from user_feedback where prompt_id is not null
  const { data: promptRatings } = await supabaseAdmin
    .from("user_feedback")
    .select("rating")
    .not("prompt_id", "is", null)
    .not("rating", "is", null);

  const ratings = (promptRatings ?? []).map((r: any) => r.rating).filter((r: number) => typeof r === "number" && r > 0);
  const avgPromptRating = ratings.length > 0 ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(2) : "—";

  // 6. Question Sharing Rate: would_share = true / Total feedback submissions with prompt_id
  const { data: shareFeedback } = await supabaseAdmin
    .from("user_feedback")
    .select("would_share")
    .not("prompt_id", "is", null);

  const totalShareFeedback = shareFeedback?.length ?? 0;
  const wouldShareCount = (shareFeedback ?? []).filter((f: any) => f.would_share === true).length;
  const questionSharingRate = totalShareFeedback > 0 ? (((wouldShareCount / totalShareFeedback) * 100).toFixed(1)) : "0.0";

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
            Response "rate" below is total posts per prompt (not distinct users).
          </div>
        </div>
      </div>

      {/* KPI Section */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Key Performance Indicators</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* 1. Prompt Completion Rate */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Prompt Completion Rate</div>
            <div className="mt-1 text-2xl font-semibold">{promptCompletionRate}%</div>
            <div className="mt-2 text-xs text-white/50">
              {postedUserSet.size} of {activeUserSet.size} active users posted today
            </div>
          </div>

          {/* 2. Response Depth */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Response Depth</div>
            <div className="mt-1 text-2xl font-semibold">{avgWordCount}</div>
            <div className="mt-2 text-xs text-white/50">
              Avg: {avgWordCount} words | Median: {medianWordCount} words
            </div>
          </div>

          {/* 3. Lurker Rate */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Lurker Rate</div>
            <div className="mt-1 text-2xl font-semibold">{lurkerRate}%</div>
            <div className="mt-2 text-xs text-white/50">
              {lurkers.length} users opened app but never posted
            </div>
          </div>

          {/* 4. Social Acknowledgement Rate */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Social Acknowledgement Rate</div>
            <div className="mt-1 text-2xl font-semibold">{socialAckRate}%</div>
            <div className="mt-2 text-xs text-white/50">
              {likedPostSet.size} of {totalPosts ?? 0} posts have likes
            </div>
          </div>

          {/* 5. Explicit Prompt Rating */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Explicit Prompt Rating</div>
            <div className="mt-1 text-2xl font-semibold">{avgPromptRating}</div>
            <div className="mt-2 text-xs text-white/50">
              Average rating: {avgPromptRating} / 5.0 ({ratings.length} ratings)
            </div>
          </div>

          {/* 6. Question Sharing Rate */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Question Sharing Rate</div>
            <div className="mt-1 text-2xl font-semibold">{questionSharingRate}%</div>
            <div className="mt-2 text-xs text-white/50">
              {wouldShareCount} of {totalShareFeedback} users would share
            </div>
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


