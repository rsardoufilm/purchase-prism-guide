import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/produtos")({
  component: Produtos,
  head: () => ({ meta: [{ title: "Produtos — AURA Finance" }] }),
});

interface It {
  normalized_product: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

function Produtos() {
  const [items, setItems] = useState<It[]>([]);
  useEffect(() => {
    supabase
      .from("receipt_items")
      .select("normalized_product,description,quantity,unit_price,total")
      .then(({ data }) => setItems((data ?? []) as It[]));
  }, []);

  const products = useMemo(() => {
    const m = new Map<
      string,
      { qty: number; total: number; prices: number[] }
    >();
    for (const it of items) {
      const k = it.normalized_product || it.description;
      const v = m.get(k) ?? { qty: 0, total: 0, prices: [] };
      v.qty += Number(it.quantity);
      v.total += Number(it.total);
      if (it.unit_price > 0) v.prices.push(Number(it.unit_price));
      m.set(k, v);
    }
    return [...m.entries()]
      .map(([name, v]) => ({
        name,
        qty: v.qty,
        total: v.total,
        avg: v.prices.length ? v.prices.reduce((a, b) => a + b, 0) / v.prices.length : 0,
        min: v.prices.length ? Math.min(...v.prices) : 0,
        max: v.prices.length ? Math.max(...v.prices) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [items]);

  return (
    <>
      <PageHeader eyebrow="Produtos" title="Catálogo de consumo" />
      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum produto registrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <details
              key={p.name}
              className="bg-card border border-border rounded-2xl p-4 group"
            >
              <summary className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 cursor-pointer list-none">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {p.qty.toLocaleString("pt-BR")} acumulado
                  </p>
                </div>
                <p className="text-sm font-bold">{brl(p.total)}</p>
              </summary>
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
                <Mini label="Médio" value={brl(p.avg)} />
                <Mini label="Mín" value={brl(p.min)} />
                <Mini label="Máx" value={brl(p.max)} />
              </div>
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
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </p>
      <p className="text-xs font-semibold">{value}</p>
    </div>
  );
}
