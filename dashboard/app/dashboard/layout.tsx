import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-semibold tracking-wide">
              PONDER Dev
            </Link>
            <nav className="flex items-center gap-4 text-sm text-white/70">
              <Link className="hover:text-white" href="/dashboard/prompts">
                Prompts
              </Link>
              <Link className="hover:text-white" href="/dashboard/window-control">
                Window Control
              </Link>
              <Link className="hover:text-white" href="/dashboard/implicit-metrics">
                Implicit Metrics
              </Link>
              <Link className="hover:text-white" href="/dashboard/explicit-metrics">
                Explicit Metrics
              </Link>
              <Link className="hover:text-white" href="/dashboard/feedback">
                Feedback
              </Link>
              <Link className="hover:text-white" href="/dashboard/performance">
                Performance
              </Link>
            </nav>
          </div>
          <form action="/api/logout" method="post">
            <button className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10">
              Logout
            </button>
          </form>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-6 py-6">{children}</div>
    </div>
  );
}





