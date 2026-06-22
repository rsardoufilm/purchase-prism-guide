export function DashboardSummarySkeleton() {
  return (
    <section aria-hidden className="mb-3 grid grid-cols-2 gap-2.5">
      {[0, 1].map((i) => (
        <div key={i} className="bg-card border border-border rounded-2xl p-3 sm:p-4 min-w-0">
          <div className="h-3 w-16 rounded bg-muted animate-pulse mb-2" />
          <div className="h-6 w-24 rounded bg-muted animate-pulse mb-1.5" />
          <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </section>
  );
}
