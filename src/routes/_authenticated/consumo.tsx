import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/consumo")({
  component: Consumo,
  head: () => ({ meta: [{ title: "Consumo — AURA Finance" }] }),
});

interface ItemRow {
  normalized_product: string | null;
  description: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  total: number;
}

function Consumo() {
  const [items, setItems] = useState<ItemRow[]>([]);
  useEffect(() => {
    supabase
      .from("receipt_items")
      .select("normalized_product,description,category,quantity,unit,total")
      .then(({ data }) => setItems((data ?? []) as ItemRow[]));
  }, []);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      const k = it.category || it.normalized_product || "Outros";
      m.set(k, (m.get(k) ?? 0) + Number(it.total));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const byProduct = useMemo(() => {
    const m = new Map<string, { total: number; qty: number; unit: string | null }>();
    for (const it of items) {
      const k = it.normalized_product || it.description;
      const v = m.get(k) ?? { total: 0, qty: 0, unit: it.unit };
      v.total += Number(it.total);
      v.qty += Number(it.quantity);
      m.set(k, v);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  }, [items]);

  return (
    <>
      <PageHeader eyebrow="Consumo" title="O que você compra" />
      <section className="mb-6">
        <h2 className="font-display font-semibold mb-3">Categorias mais consumidas</h2>
        <div className="space-y-2">
          {byCategory.slice(0, 6).map(([cat, total]) => (
            <div
              key={cat}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-card border border-border rounded-2xl p-4"
            >
              <p className="text-sm font-semibold truncate">{cat}</p>
              <p className="text-sm font-bold">{brl(total)}</p>
            </div>
          ))}
          {byCategory.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum item registrado ainda.</p>
          )}
        </div>
      </section>
      <section>
        <h2 className="font-display font-semibold mb-3">Produtos mais consumidos</h2>
        <div className="space-y-2">
          {byProduct.map(([prod, v]) => (
            <div
              key={prod}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-card border border-border rounded-2xl p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{prod}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {v.qty.toLocaleString("pt-BR")} {v.unit ?? "un"} acumulado
                </p>
              </div>
              <p className="text-sm font-bold">{brl(v.total)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
