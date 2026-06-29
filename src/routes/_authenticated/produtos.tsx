import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { brl } from "@/lib/format";
import {
  scanDuplicates,
  acceptUnification,
  rejectUnification,
  type DuplicateSuggestion,
} from "@/lib/duplicate-scan";
import { ProductAliasDialog } from "@/components/product-alias-dialog";
import { Sparkles, EyeOff, Eye } from "lucide-react";
import {
  loadHighlightFilters,
  toggleProductIgnored,
  normalizeProductKey,
  type HighlightFilters,
} from "@/lib/highlight-filters";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/produtos")({
  component: Produtos,
  head: () => ({ meta: [{ title: "Produtos — AURA Consumo" }] }),
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
  const [suggestions, setSuggestions] = useState<DuplicateSuggestion[]>([]);
  const [reviewing, setReviewing] = useState<DuplicateSuggestion | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [filters, setFilters] = useState<HighlightFilters>({
    ignoredCategories: new Set(),
    ignoredProducts: new Set(),
  });

  const refreshFilters = useCallback(() => {
    loadHighlightFilters().then(setFilters);
  }, []);

  useEffect(() => {
    const load = () => {
      supabase
        .from("product_prices")
        .select("normalized_name,merchant_name,unit_price,quantity,unit,purchase_date")
        .order("purchase_date", { ascending: false })
        .then(({ data }) => setPrices((data ?? []) as Price[]));
      refreshFilters();
    };
    load();
    window.addEventListener("aura:data-changed", load);
    return () => window.removeEventListener("aura:data-changed", load);
  }, [refreshFilters]);

  const runScan = useCallback(async (uid: string) => {
    try {
      const { pending } = await scanDuplicates(uid);
      setSuggestions(pending);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      setUserId(uid);
      runScan(uid);
    });
    return () => {
      cancelled = true;
    };
  }, [runScan]);

  const products = useMemo(() => {
    type Agg = {
      qty: number;
      total: number;
      prices: number[];
      byStore: Map<string, number[]>;
      unit: string | null;
    };
    const m = new Map<string, Agg>();
    for (const p of prices) {
      const v: Agg = m.get(p.normalized_name) ?? {
        qty: 0,
        total: 0,
        prices: [],
        byStore: new Map<string, number[]>(),
        unit: p.unit,
      };
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

  const handleSame = async () => {
    if (!reviewing || !userId) return;
    // canonical = nome_a (ordem alfabética estável); other = nome_b
    await acceptUnification(userId, reviewing.id, reviewing.nome_a, reviewing.nome_b);
    setReviewing(null);
    setSuggestions((s) => s.filter((x) => x.id !== reviewing.id));
    window.dispatchEvent(new CustomEvent("aura:data-changed"));
  };

  const handleDifferent = async () => {
    if (!reviewing || !userId) return;
    await rejectUnification(userId, reviewing.id, reviewing.nome_a, reviewing.nome_b);
    setReviewing(null);
    setSuggestions((s) => s.filter((x) => x.id !== reviewing.id));
  };

  return (
    <>
      <PageHeader eyebrow="Produtos" title="Catálogo de consumo" />

      {suggestions.length > 0 && (
        <button
          type="button"
          onClick={() => setReviewing(suggestions[0])}
          className="w-full mb-3 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary-soft/40 px-3 py-2.5 text-left hover:bg-primary-soft/60 transition"
        >
          <div className="size-8 rounded-xl bg-primary/15 grid place-items-center text-primary shrink-0">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">
              Encontramos {suggestions.length}{" "}
              {suggestions.length === 1 ? "produto que pode ser" : "produtos que podem ser"} o mesmo
              item
            </p>
            <p className="text-[11px] text-muted-foreground truncate">Revisar →</p>
          </div>
        </button>
      )}

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum produto registrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {products.map((p) => {
            const ignored = filters.ignoredProducts.has(normalizeProductKey(p.name));
            const handleToggle = async (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              if (!userId) return;
              try {
                await toggleProductIgnored(userId, p.name, ignored);
                refreshFilters();
                window.dispatchEvent(new CustomEvent("aura:data-changed"));
                toast.success(ignored ? "Voltou a aparecer nos destaques" : "Oculto dos destaques");
              } catch {
                toast.error("Não foi possível atualizar.");
              }
            };
            return (
              <details
                key={p.name}
                className="bg-card border border-border rounded-2xl p-3 sm:p-4 group"
              >
                <summary className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 cursor-pointer list-none">
                  <div className="min-w-0 flex items-center gap-2">
                    {ignored && (
                      <EyeOff className="size-3.5 text-muted-foreground shrink-0" aria-label="Oculto dos destaques" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                        {p.qty.toLocaleString("pt-BR")} {p.unit ?? "un"} acumulado
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold">{brl(p.total)}</p>
                </summary>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
                  <Mini label="Médio" value={brl(p.avg)} />
                  <Mini label="Mín" value={brl(p.min)} />
                  <Mini label="Máx" value={brl(p.max)} />
                </div>
                {p.cheapestStore && (
                  <p className="text-[11px] text-primary mt-2 font-medium truncate">
                    Mais barato em <span className="font-semibold">{p.cheapestStore.s}</span> (
                    {brl(p.cheapestStore.avg)})
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleToggle}
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition"
                >
                  {ignored ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                  {ignored ? "Mostrar nos destaques" : "Ignorar nos destaques"}
                </button>
              </details>
            );
          })}
        </div>
      )}

      <ProductAliasDialog
        open={!!reviewing}
        candidate={
          reviewing
            ? {
                index: 0,
                newName: reviewing.nome_b,
                existingName: reviewing.nome_a,
                similarity: Number(reviewing.similaridade),
              }
            : null
        }
        onSame={handleSame}
        onDifferent={handleDifferent}
        onSkip={() => setReviewing(null)}
      />
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
