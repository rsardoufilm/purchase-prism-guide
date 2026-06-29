import { createFileRoute } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

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
  const [visibleCount, setVisibleCount] = useState(20);


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
          {products.slice(0, visibleCount).map((p) => (
            <ProductCard
              key={p.name}
              product={p}
              userId={userId}
              ignored={filters.ignoredProducts.has(normalizeProductKey(p.name))}
              onAfterToggle={refreshFilters}
            />
          ))}
          {products.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + 20)}
              className="w-full h-11 rounded-2xl border border-dashed border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Carregar mais ({products.length - visibleCount} restantes)
            </button>
          )}
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
