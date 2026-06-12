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

interface E { merchant_name: string; total_amount: number; category: string | null; expense_date: string }
interface P { normalized_name: string; merchant_name: string; unit_price: number; purchase_date: string }

function Insights() {
  const [expenses, setExpenses] = useState<E[]>([]);
  const [prices, setPrices] = useState<P[]>([]);

  useEffect(() => {
    supabase.from("expenses").select("merchant_name,total_amount,category,expense_date")
      .then(({ data }) => setExpenses((data ?? []) as E[]));
    supabase.from("product_prices").select("normalized_name,merchant_name,unit_price,purchase_date")
      .order("purchase_date", { ascending: true })
      .then(({ data }) => setPrices((data ?? []) as P[]));
  }, []);

  const insights = useMemo(() => {
    const out: { icon: React.ReactNode; title: string; desc: string }[] = [];

    if (expenses.length === 0) {
      return [{
        icon: <Sparkles className="size-5" />,
        title: "Comece a registrar",
        desc: "Adicione suas primeiras notas fiscais para que a AURA descubra padrões e oportunidades de economia.",
      }];
    }

    const byCat = new Map<string, number>();
    for (const r of expenses) {
      const k = r.category || "Sem categoria";
      byCat.set(k, (byCat.get(k) ?? 0) + Number(r.total_amount));
    }
    const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      out.push({
        icon: <Sparkles className="size-5" />,
        title: `${top[0]} é sua maior categoria`,
        desc: `${brl(top[1])} no total registrado.`,
      });
    }

    const byStore = new Map<string, { sum: number; count: number }>();
    for (const r of expenses) {
      const v = byStore.get(r.merchant_name) ?? { sum: 0, count: 0 };
      v.sum += Number(r.total_amount); v.count++; byStore.set(r.merchant_name, v);
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

    // Variação de preço por produto (do histórico product_prices)
    const prodPrices = new Map<string, P[]>();
    for (const p of prices) {
      const arr = prodPrices.get(p.normalized_name) ?? [];
      arr.push(p);
      prodPrices.set(p.normalized_name, arr);
    }

    let biggestSwing: { name: string; min: number; max: number; minStore: string; maxStore: string } | null = null;
    let priceUp: { name: string; first: number; last: number; pct: number } | null = null;
    for (const [name, arr] of prodPrices) {
      if (arr.length < 2) continue;
      const sorted = [...arr].sort((a, b) => Number(a.unit_price) - Number(b.unit_price));
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      if (!biggestSwing || Number(max.unit_price) - Number(min.unit_price) > biggestSwing.max - biggestSwing.min) {
        biggestSwing = {
          name, min: Number(min.unit_price), max: Number(max.unit_price),
          minStore: min.merchant_name, maxStore: max.merchant_name,
        };
      }
      // Aumento no tempo
      const byDate = [...arr].sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));
      const first = Number(byDate[0].unit_price);
      const last = Number(byDate[byDate.length - 1].unit_price);
      if (first > 0 && last > first) {
        const pct = ((last - first) / first) * 100;
        if (!priceUp || pct > priceUp.pct) priceUp = { name, first, last, pct };
      }
    }

    if (biggestSwing) {
      const pct = ((biggestSwing.max - biggestSwing.min) / biggestSwing.min) * 100;
      out.push({
        icon: <TrendingDown className="size-5" />,
        title: `${biggestSwing.name} varia ${pct.toFixed(0)}% entre lojas`,
        desc: `${brl(biggestSwing.min)} em ${biggestSwing.minStore} vs ${brl(biggestSwing.max)} em ${biggestSwing.maxStore}.`,
      });
    }
    if (priceUp) {
      out.push({
        icon: <TrendingUp className="size-5" />,
        title: `${priceUp.name} subiu ${priceUp.pct.toFixed(0)}%`,
        desc: `De ${brl(priceUp.first)} para ${brl(priceUp.last)} no histórico.`,
      });
    }

    return out;
  }, [expenses, prices]);

  return (
    <>
      <PageHeader eyebrow="Insights" title="Sua inteligência" />
      <div className="space-y-3">
        {insights.map((ins, i) => (
          <div key={i} className="bg-card border border-border rounded-3xl p-5 grid grid-cols-[auto_minmax(0,1fr)] gap-4">
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
