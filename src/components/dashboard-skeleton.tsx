export function DashboardCardsSkeleton() {
  return (
    <section aria-hidden className="grid grid-cols-2 gap-2.5 mb-3">
      <div className="col-span-2 bg-card p-4 sm:p-6 rounded-3xl border border-border">
        <div className="h-3 w-32 rounded bg-muted animate-pulse mb-3" />
        <div className="h-9 w-44 rounded bg-muted animate-pulse mb-2" />
        <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-card p-3 sm:p-4 rounded-3xl border border-border min-w-0">
          <div className="h-2.5 w-20 rounded bg-muted animate-pulse mb-2" />
          <div className="h-4 w-24 rounded bg-muted animate-pulse mb-1.5" />
          <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </section>
  );
}

export function RecentExpensesSkeleton() {
  return (
    <div aria-hidden className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-card p-4 rounded-2xl border border-border">
          <div className="size-10 shrink-0 rounded-xl bg-muted animate-pulse" />
          <div className="min-w-0">
            <div className="h-3.5 w-40 rounded bg-muted animate-pulse mb-1.5" />
            <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-4 w-16 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}
