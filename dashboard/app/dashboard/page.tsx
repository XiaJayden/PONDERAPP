export default function DashboardHome() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-sm text-white/70">
        Use the nav to manage prompts, force open/close prompt windows for a user, and review alpha metrics.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium">Prompt Management</div>
          <div className="mt-1 text-xs text-white/60">Create, edit, delete and preview prompt popups.</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium">Window Control</div>
          <div className="mt-1 text-xs text-white/60">Force open/close the response window for a user.</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium">Metrics</div>
          <div className="mt-1 text-xs text-white/60">Inspect implicit events + explicit feedback.</div>
        </div>
      </div>
    </div>
  );
}





