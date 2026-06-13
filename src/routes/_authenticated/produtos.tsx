import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/produtos")({
  component: Produtos,
  head: () => ({ meta: [{ title: "Produtos — AURA Finance" }] }),
});

interface Price {
  normalized_name: string;
  merchant_name: string;
  unit_price: number;
  quantity: number;
  unit: string | null;
  purchase_date: string;
}

function Produtos() {
  const [prices, setPrices] = useState<Price[]>([]);
  useEffect(() => {
    supabase
      .from("product_prices")
      .select("normalized_name,merchant_name,unit_price,quantity,unit,purchase_date")
      .order("purchase_date", { ascending: false })
      .then(({ data }) => setPrices((data ?? []) as Price[]));
  }, []);

  const products = useMemo(() => {
    type Agg = {
      qty: number; total: number; prices: number[];
      byStore: Map<string, number[]>; unit: string | null;
    };
    const m = new Map<string, Agg>();
    for (const p of prices) {
      const v = m.get(p.normalized_name) ?? { qty: 0, total: 0, prices: [], byStore: new Map(), unit: p.unit };
      v.qty += Number(p.quantity);
      v.total += Number(p.unit_price) * Number(p.quantity);
      v.prices.push(Number(p.unit_price));
      const arr: number[] = v.byStore.get(p.merchant_name) ?? [];
      arr.push(Number(p.unit_price));
      v.byStore.set(p.merchant_name, arr);
      m.set(p.normalized_name, v);
    }
    return [...m.entries()]
      .map(([name, v]) => {
        const avg = v.prices.reduce((a, b) => a + b, 0) / v.prices.length;
        const min = Math.min(...v.prices);
        const max = Math.max(...v.prices);
        const cheapestStore = [...v.byStore.entries()]
          .map(([s, arr]) => ({ s, avg: arr.reduce((a, b) => a + b, 0) / arr.length }))
          .sort((a, b) => a.avg - b.avg)[0];
        return { name, qty: v.qty, total: v.total, avg, min, max, cheapestStore, unit: v.unit };
      })
      .sort((a, b) => b.total - a.total);
  }, [prices]);

  return (
    <>
      <PageHeader eyebrow="Produtos" title="Catálogo de consumo" />
      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum produto registrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <details key={p.name} className="bg-card border border-border rounded-2xl p-4 group">
              <summary className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 cursor-pointer list-none">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {p.qty.toLocaleString("pt-BR")} {p.unit ?? "un"} acumulado
                  </p>
                </div>
                <p className="text-sm font-bold">{brl(p.total)}</p>
              </summary>
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
                <Mini label="Médio" value={brl(p.avg)} />
                <Mini label="Mín" value={brl(p.min)} />
                <Mini label="Máx" value={brl(p.max)} />
              </div>
              {p.cheapestStore && (
                <p className="text-[11px] text-primary mt-3 font-medium">
                  Mais barato em <span className="font-semibold">{p.cheapestStore.s}</span> ({brl(p.cheapestStore.avg)})
                </p>
              )}
            </details>
          ))}
        </div>
      )}
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className="text-xs font-semibold">{value}</p>
    </div>
  );
}
