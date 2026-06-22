import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { CalendarDays, TrendingUp } from "lucide-react";
import { DashboardSummarySkeleton } from "./dashboard-summary-skeleton";

export function DashboardSummaryCard() {
  const [today, setToday] = useState(0);
  const [week, setWeek] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [weekCount, setWeekCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 6);
      const weekStartStr = weekStart.toISOString().slice(0, 10);

      const [d, w] = await Promise.all([
        supabase.from("expenses").select("total_amount").eq("expense_date", todayStr),
        supabase.from("expenses").select("total_amount").gte("expense_date", weekStartStr).lte("expense_date", todayStr),
      ]);
      if (cancel) return;
      const dRows = d.data ?? [];
      const wRows = w.data ?? [];
      setToday(dRows.reduce((s, r) => s + Number(r.total_amount), 0));
      setWeek(wRows.reduce((s, r) => s + Number(r.total_amount), 0));
      setTodayCount(dRows.length);
      setWeekCount(wRows.length);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  if (loading) return <DashboardSummarySkeleton />;
  if (today === 0 && week === 0) return null;

  return (
    <section
      aria-label="Resumo rápido"
      className="mb-3 grid grid-cols-2 gap-2.5 animate-aura-in"
    >
      <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden />
          <p className="text-[10px] font-semibold uppercase tracking-wider truncate">Hoje</p>
        </div>
        <p className="font-display text-lg sm:text-xl font-bold tracking-tight truncate">{brl(today)}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
          {todayCount} {todayCount === 1 ? "despesa" : "despesas"}
        </p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
          <TrendingUp className="size-3.5 shrink-0" aria-hidden />
          <p className="text-[10px] font-semibold uppercase tracking-wider truncate">Últimos 7 dias</p>
        </div>
        <p className="font-display text-lg sm:text-xl font-bold tracking-tight truncate">{brl(week)}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
          {weekCount} {weekCount === 1 ? "despesa" : "despesas"}
        </p>
      </div>
    </section>
  );
}

