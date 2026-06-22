import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { TourGuide } from "@/components/tour-guide";
import { TOURS } from "@/lib/tours";
import { PeriodFilter } from "@/components/period-filter";
import { periodRange, type PeriodKey } from "@/lib/period";
import { brl, brlCompact, fmtDate } from "@/lib/format";
import { Sparkles, TrendingDown, Store, Package as PackageIcon } from "lucide-react";
import { DashboardSummaryCard } from "@/components/dashboard-summary-card";
import { DashboardCardsSkeleton, RecentExpensesSkeleton } from "@/components/dashboard-skeleton";
import { useSharedPeriod } from "@/hooks/use-shared-period";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — AURA Consumo" },
      { name: "description", content: "Resumo inteligente do seu consumo no período." },
    ],
  }),
});

interface ExpenseRow {
  id: string;
  merchant_name: string;
  category: string | null;
  expense_date: string;
  total_amount: number;
}
interface ItemRow {
  normalized_name: string | null;
  raw_name: string;
  total_price: number;
  unit_price: number;
  category: string | null;
}

function isoDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : null;
}

function Dashboard() {
  const [period, setPeriod] = useSharedPeriod();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const onChange = () => setReloadTick((t) => t + 1);
    window.addEventListener("aura:data-changed", onChange);
    return () => window.removeEventListener("aura:data-changed", onChange);
  }, []);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const { start, end } = periodRange(period);
    const s = isoDate(start);
    const e = isoDate(end);
    (async () => {
      let q = supabase
        .from("expenses")
        .select("id,merchant_name,category,expense_date,total_amount")
        .order("expense_date", { ascending: false });
      if (s) q = q.gte("expense_date", s);
      if (e) q = q.lte("expense_date", e);
      const { data: exp } = await q;
      const expRows = (exp ?? []) as ExpenseRow[];

      const ids = expRows.map((r) => r.id);
      let itRows: ItemRow[] = [];
      if (ids.length) {
        const { data: it } = await supabase
          .from("expense_items")
          .select("normalized_name,raw_name,total_price,unit_price,category")
          .in("expense_id", ids);
        itRows = (it ?? []) as ItemRow[];
      }

      if (cancel) return;
      setExpenses(expRows);
      setItems(itRows);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [period, reloadTick]);

  const kpis = useMemo(() => {
    const total = expenses.reduce((s, r) => s + Number(r.total_amount), 0);

    const byCat = new Map<string, number>();
    for (const r of expenses) {
      const k = r.category || "Sem categoria";
      byCat.set(k, (byCat.get(k) ?? 0) + Number(r.total_amount));
    }
    const catList = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    const topCat = catList[0];

    const byProd = new Map<string, number>();
    for (const it of items) {
      const k = it.normalized_name || it.raw_name;
      byProd.set(k, (byProd.get(k) ?? 0) + Number(it.total_price ?? 0));
    }
    const topProd = [...byProd.entries()].sort((a, b) => b[1] - a[1])[0];

    const byStore = new Map<string, number>();
    for (const r of expenses) byStore.set(r.merchant_name, (byStore.get(r.merchant_name) ?? 0) + 1);
    const topStore = [...byStore.entries()].sort((a, b) => b[1] - a[1])[0];

    // Economia: itens com preço unitário abaixo da média do produto normalizado
    const prodAvg = new Map<string, { sum: number; count: number }>();
    for (const it of items) {
      const k = it.normalized_name;
      if (!k || !it.unit_price) continue;
      const v = prodAvg.get(k) ?? { sum: 0, count: 0 };
      v.sum += Number(it.unit_price);
      v.count += 1;
      prodAvg.set(k, v);
    }
    let savings = 0;
    for (const it of items) {
      const k = it.normalized_name;
      if (!k || !it.unit_price) continue;
      const stats = prodAvg.get(k);
      if (!stats || stats.count < 2) continue;
      const avg = stats.sum / stats.count;
      if (Number(it.unit_price) < avg) savings += (avg - Number(it.unit_price)) * 1;
    }

    return { total, topCat, topProd, topStore, savings, catList };
  }, [expenses, items]);

  return (
    <>
      <PageHeader eyebrow="Dashboard" title="AURA Consumo" />

      <DashboardSummaryCard />

      <div className="mb-3 animate-aura-in">
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      {loading ? (
        <DashboardCardsSkeleton />
      ) : (
        <section className="grid grid-cols-2 gap-2.5 mb-3 animate-aura-in">
          <div className="col-span-2 bg-card p-4 sm:p-6 rounded-3xl border border-border shadow-[var(--shadow-card)]">
            <p className="text-muted-foreground text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider mb-1.5">
              Total gasto no período
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-muted-foreground text-base sm:text-lg font-medium">R$</span>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
                {brl(kpis.total).replace("R$", "").trim()}
              </h2>
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1.5">
              {expenses.length} {expenses.length === 1 ? "nota fiscal" : "notas fiscais"}
            </p>
          </div>

          <KpiCard
            icon={<PackageIcon className="size-4" />}
            label="Categoria top"
            value={kpis.topCat?.[0] ?? "—"}
            sub={kpis.topCat ? brlCompact(kpis.topCat[1]) : ""}
          />
          <KpiCard
            icon={<Sparkles className="size-4" />}
            label="Produto top"
            value={kpis.topProd?.[0] ?? "—"}
            sub={kpis.topProd ? brlCompact(kpis.topProd[1]) : ""}
          />
          <KpiCard
            icon={<Store className="size-4" />}
            label="Estabelecimento"
            value={kpis.topStore?.[0] ?? "—"}
            sub={
              kpis.topStore ? `${kpis.topStore[1]} visita${kpis.topStore[1] > 1 ? "s" : ""}` : ""
            }
          />
          <KpiCard
            icon={<TrendingDown className="size-4" />}
            label="Economia"
            value={brl(kpis.savings)}
            sub="vs. preço médio"
            accent
          />
        </section>
      )}

      {!loading && kpis.catList.length > 0 && (
        <section className="mb-3 animate-aura-in">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-semibold text-sm">Gastos por categoria</h3>
            <span className="text-[10px] text-muted-foreground">
              {kpis.catList.length} categorias
            </span>
          </div>
          <div className="space-y-1.5">
            {kpis.catList.slice(0, 6).map(([cat, total]) => {
              const pct = kpis.total > 0 ? (total / kpis.total) * 100 : 0;
              const uncategorized = cat === "Sem categoria";
              return (
                <div key={cat} className="bg-card border border-border rounded-2xl p-3">
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <p
                      className={`text-xs font-semibold truncate ${uncategorized ? "text-amber-600 dark:text-amber-500" : ""}`}
                    >
                      {cat}
                    </p>
                    <p className="text-xs font-bold whitespace-nowrap">
                      {brl(total)}{" "}
                      <span className="text-muted-foreground font-normal">· {pct.toFixed(0)}%</span>
                    </p>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${uncategorized ? "bg-amber-500/70" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-3 animate-aura-in">
        <div className="bg-secondary text-secondary-foreground p-4 rounded-3xl relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-display text-base font-semibold mb-0.5">Insight</h3>
            <p className="text-secondary-foreground/70 text-xs sm:text-sm leading-relaxed max-w-[85%]">
              {expenses.length === 0
                ? "Adicione sua primeira nota fiscal para receber insights de consumo."
                : kpis.topCat
                  ? `Sua categoria principal é ${kpis.topCat[0]}, com ${brlCompact(kpis.topCat[1])} no período.`
                  : "Continue registrando para descobrir padrões."}
            </p>
          </div>
          <div
            className="absolute -right-6 -bottom-6 size-32 bg-primary rounded-full blur-3xl opacity-25"
            aria-hidden
          />
        </div>
      </section>

      <section className="animate-aura-in mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-semibold text-sm">Recentes</h3>
        </div>

        {loading ? (
          <RecentExpensesSkeleton />
        ) : expenses.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma despesa no período.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.slice(0, 5).map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-card p-4 rounded-2xl border border-border"
              >
                <div className="size-10 shrink-0 rounded-xl bg-muted grid place-items-center font-mono text-[10px] font-bold text-muted-foreground">
                  NF
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{r.merchant_name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {fmtDate(r.expense_date)} {r.category ? `• ${r.category}` : ""}
                  </p>
                </div>
                <p className="text-sm font-bold text-right">{brl(Number(r.total_amount))}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-card p-3 sm:p-4 rounded-3xl border border-border shadow-[var(--shadow-card)] min-w-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={accent ? "text-primary" : "text-muted-foreground"}>{icon}</span>
        <p className="text-muted-foreground text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider truncate">
          {label}
        </p>
      </div>
      <p className={`font-semibold text-xs sm:text-sm truncate ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>
    </div>
  );
}
