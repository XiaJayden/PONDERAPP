import Link from "next/link";

export default function Home() {
  const next = "/dashboard";
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-white/60">PONDER</div>
              <h1 className="mt-1 text-xl font-semibold">Development Dashboard</h1>
            </div>
            <Link className="text-sm text-white/70 underline underline-offset-4" href="/dashboard">
              Go to dashboard
            </Link>
          </div>

          <form action="/api/login" method="post" className="mt-6">
            <input type="hidden" name="next" value={next} />
            <label className="block text-sm text-white/70" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-white/25"
              placeholder="Enter DASHBOARD_PASSWORD"
              required
            />
            <button
              type="submit"
              className="mt-4 w-full rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Sign in
            </button>
          </form>

          <p className="mt-4 text-xs text-white/50">
            Set <code className="rounded bg-white/10 px-1 py-0.5">DASHBOARD_PASSWORD</code> on Vercel + locally.
          </p>
        </div>
      </div>
    </div>
  );
}
