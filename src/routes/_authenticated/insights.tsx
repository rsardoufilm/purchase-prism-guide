import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { brl } from "@/lib/format";
import { Sparkles, TrendingUp, TrendingDown, Store } from "lucide-react";

export const Route = createFileRoute("/_authenticated/insights")({
  component: Insights,
  head: () => ({ meta: [{ title: "Insights — AURA Finance" }] }),
});

interface R { merchant: string; total: number; category: string | null; purchased_at: string }
interface It { normalized_product: string | null; description: string; unit_price: number; total: number }

function Insights() {
  const [receipts, setReceipts] = useState<R[]>([]);
  const [items, setItems] = useState<It[]>([]);

  useEffect(() => {
    supabase.from("receipts").select("merchant,total,category,purchased_at").then(({ data }) => setReceipts((data ?? []) as R[]));
    supabase.from("receipt_items").select("normalized_product,description,unit_price,total").then(({ data }) => setItems((data ?? []) as It[]));
  }, []);

  const insights = useMemo(() => {
    const out: { icon: React.ReactNode; title: string; desc: string }[] = [];

    if (receipts.length === 0) {
      return [{
        icon: <Sparkles className="size-5" />,
        title: "Comece a registrar",
        desc: "Adicione suas primeiras notas fiscais para que a AURA descubra padrões e oportunidades de economia.",
      }];
    }

    // Top category
    const byCat = new Map<string, number>();
    for (const r of receipts) {
      const k = r.category || "Sem categoria";
      byCat.set(k, (byCat.get(k) ?? 0) + Number(r.total));
    }
    const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      out.push({
        icon: <Sparkles className="size-5" />,
        title: `${top[0]} é sua maior categoria`,
        desc: `${brl(top[1])} no total registrado.`,
      });
    }

    // Cheapest / most expensive store by avg ticket
    const byStore = new Map<string, { sum: number; count: number }>();
    for (const r of receipts) {
      const v = byStore.get(r.merchant) ?? { sum: 0, count: 0 };
      v.sum += Number(r.total); v.count++; byStore.set(r.merchant, v);
    }
    const stores = [...byStore.entries()]
      .filter(([_, v]) => v.count >= 2)
      .map(([n, v]) => ({ n, avg: v.sum / v.count }))
      .sort((a, b) => a.avg - b.avg);
    if (stores.length >= 1) {
      out.push({
        icon: <Store className="size-5" />,
        title: `${stores[0].n} é seu estabelecimento mais barato`,
        desc: `Ticket médio de ${brl(stores[0].avg)}.`,
      });
    }
    if (stores.length >= 2) {
      const exp = stores[stores.length - 1];
      out.push({
        icon: <TrendingUp className="size-5" />,
        title: `${exp.n} tem o ticket médio mais alto`,
        desc: `Cada visita custa em média ${brl(exp.avg)}.`,
      });
    }

    // Price variance per product
    const prodPrices = new Map<string, number[]>();
    for (const it of items) {
      const k = it.normalized_product || it.description;
      if (it.unit_price > 0) {
        const arr = prodPrices.get(k) ?? [];
        arr.push(Number(it.unit_price));
        prodPrices.set(k, arr);
      }
    }
    let biggestSwing: { name: string; min: number; max: number } | null = null;
    for (const [name, prices] of prodPrices) {
      if (prices.length < 2) continue;
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (!biggestSwing || max - min > biggestSwing.max - biggestSwing.min) {
        biggestSwing = { name, min, max };
      }
    }
    if (biggestSwing) {
      const pct = ((biggestSwing.max - biggestSwing.min) / biggestSwing.min) * 100;
      out.push({
        icon: <TrendingDown className="size-5" />,
        title: `${biggestSwing.name} variou ${pct.toFixed(0)}% em preço`,
        desc: `De ${brl(biggestSwing.min)} a ${brl(biggestSwing.max)}. Compre na loja mais barata para economizar.`,
      });
    }

    return out;
  }, [receipts, items]);

  return (
    <>
      <PageHeader eyebrow="Insights" title="Sua inteligência" />
      <div className="space-y-3">
        {insights.map((ins, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-3xl p-5 grid grid-cols-[auto_minmax(0,1fr)] gap-4"
          >
            <div className="size-11 shrink-0 rounded-2xl bg-primary-soft text-primary grid place-items-center">
              {ins.icon}
            </div>
            <div className="min-w-0">
              <p className="font-display font-semibold text-base text-balance">{ins.title}</p>
              <p className="text-sm text-muted-foreground mt-1 text-pretty">{ins.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
