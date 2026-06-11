import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { PeriodFilter } from "@/components/period-filter";
import { periodRange, type PeriodKey } from "@/lib/period";
import { brl, brlCompact, fmtDateTime } from "@/lib/format";
import { Sparkles, TrendingDown, Store, Package as PackageIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — AURA Finance" },
      { name: "description", content: "Resumo inteligente do seu consumo no período." },
    ],
  }),
});

interface ReceiptRow {
  id: string;
  merchant: string;
  category: string | null;
  purchased_at: string;
  total: number;
}
interface ItemRow {
  normalized_product: string | null;
  description: string;
  total: number;
  category: string | null;
}

function Dashboard() {
  const [period, setPeriod] = useState<PeriodKey>("este_mes");
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const { start, end } = periodRange(period);
    (async () => {
      let q = supabase
        .from("receipts")
        .select("id, merchant, category, purchased_at, total")
        .order("purchased_at", { ascending: false });
      if (start) q = q.gte("purchased_at", start.toISOString());
      if (end) q = q.lte("purchased_at", end.toISOString());
      const { data: rec } = await q;

      let q2 = supabase
        .from("receipt_items")
        .select("normalized_product, description, total, category, receipts!inner(purchased_at)");
      if (start) q2 = q2.gte("receipts.purchased_at", start.toISOString());
      if (end) q2 = q2.lte("receipts.purchased_at", end.toISOString());
      const { data: it } = await q2;

      if (cancel) return;
      setReceipts((rec ?? []) as ReceiptRow[]);
      setItems(((it ?? []) as unknown as ItemRow[]) || []);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [period]);

  const kpis = useMemo(() => {
    const total = receipts.reduce((s, r) => s + Number(r.total), 0);

    const byCat = new Map<string, number>();
    for (const r of receipts) {
      const k = r.category || "Sem categoria";
      byCat.set(k, (byCat.get(k) ?? 0) + Number(r.total));
    }
    const topCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];

    const byProd = new Map<string, number>();
    for (const it of items) {
      const k = it.normalized_product || it.description;
      byProd.set(k, (byProd.get(k) ?? 0) + Number(it.total ?? 0));
    }
    const topProd = [...byProd.entries()].sort((a, b) => b[1] - a[1])[0];

    const byStore = new Map<string, number>();
    for (const r of receipts) {
      byStore.set(r.merchant, (byStore.get(r.merchant) ?? 0) + 1);
    }
    const topStore = [...byStore.entries()].sort((a, b) => b[1] - a[1])[0];

    // savings: count of items whose unit price is below their normalized-product average
    const prodAvg = new Map<string, { sum: number; count: number }>();
    for (const it of items) {
      const k = it.normalized_product;
      if (!k) continue;
      const v = prodAvg.get(k) ?? { sum: 0, count: 0 };
      v.sum += Number(it.total ?? 0);
      v.count += 1;
      prodAvg.set(k, v);
    }
    let savings = 0;
    for (const it of items) {
      const k = it.normalized_product;
      if (!k) continue;
      const stats = prodAvg.get(k);
      if (!stats || stats.count < 2) continue;
      const avg = stats.sum / stats.count;
      if (Number(it.total ?? 0) < avg) savings += avg - Number(it.total ?? 0);
    }

    return { total, topCat, topProd, topStore, savings };
  }, [receipts, items]);

  return (
    <>
      <PageHeader eyebrow="Dashboard" title="AURA Finance" />

      <div className="mb-6 animate-aura-in">
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <section className="grid grid-cols-2 gap-3 mb-5 animate-aura-in">
        <div className="col-span-2 bg-card p-6 rounded-3xl border border-border shadow-[var(--shadow-card)]">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider mb-2">
            Total gasto no período
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground text-lg font-medium">R$</span>
            <h2 className="font-display text-4xl font-bold tracking-tight">
              {brl(kpis.total).replace("R$", "").trim()}
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {receipts.length} {receipts.length === 1 ? "nota fiscal" : "notas fiscais"}
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
          sub={kpis.topStore ? `${kpis.topStore[1]} visita${kpis.topStore[1] > 1 ? "s" : ""}` : ""}
        />
        <KpiCard
          icon={<TrendingDown className="size-4" />}
          label="Economia"
          value={brl(kpis.savings)}
          sub="vs. preço médio"
          accent
        />
      </section>

      <section className="mb-6 animate-aura-in">
        <div className="bg-secondary text-secondary-foreground p-5 rounded-3xl relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-display text-lg font-semibold mb-1">Insight</h3>
            <p className="text-secondary-foreground/70 text-sm leading-relaxed max-w-[85%]">
              {receipts.length === 0
                ? "Adicione sua primeira nota fiscal para receber insights de consumo."
                : kpis.topCat
                  ? `Sua categoria principal é ${kpis.topCat[0]}, com ${brlCompact(kpis.topCat[1])} no período.`
                  : "Continue registrando para descobrir padrões."}
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 size-32 bg-primary rounded-full blur-3xl opacity-25" />
        </div>
      </section>

      <section className="animate-aura-in mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold">Recentes</h3>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : receipts.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma despesa no período.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {receipts.slice(0, 5).map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-card p-4 rounded-2xl border border-border"
              >
                <div className="size-10 shrink-0 rounded-xl bg-muted grid place-items-center font-mono text-[10px] font-bold text-muted-foreground">
                  NF
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{r.merchant}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {fmtDateTime(r.purchased_at)} {r.category ? `• ${r.category}` : ""}
                  </p>
                </div>
                <p className="text-sm font-bold text-right">{brl(Number(r.total))}</p>
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
    <div className="bg-card p-4 rounded-3xl border border-border shadow-[var(--shadow-card)] min-w-0">
      <div className="flex items-center gap-1.5 mb-2">
        <span className={accent ? "text-primary" : "text-muted-foreground"}>{icon}</span>
        <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </p>
      </div>
      <p className={`font-semibold text-sm truncate ${accent ? "text-primary" : ""}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>
    </div>
  );
}
