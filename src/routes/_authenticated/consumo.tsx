import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Filter, Tag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { MERCHANT_CATEGORY_OPTIONS } from "@/lib/classifier";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/consumo")({
  component: Consumo,
  head: () => ({ meta: [{ title: "Consumo — AURA Consumo" }] }),
});

interface ItemRow {
  normalized_name: string | null;
  raw_name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  total_price: number;
  expense_id: string;
}
interface ExpenseRow {
  id: string;
  merchant_name: string;
  category: string | null;
  total_amount: number;
}

const CONSUMO_FILTER_KEY = "aura:consumo:filter-category";

function Consumo() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [filter, setFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "all";
    return window.localStorage.getItem(CONSUMO_FILTER_KEY) ?? "all";
  });
  const [bulkTarget, setBulkTarget] = useState<{ from: string; count: number } | null>(null);
  const [bulkNewCat, setBulkNewCat] = useState<string>("");
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(CONSUMO_FILTER_KEY, filter);
  }, [filter]);

  const reclassifyCategory = async () => {
    if (!bulkTarget || !bulkNewCat) return;
    setBulkSaving(true);
    const fromCat = bulkTarget.from;
    const isUncat = fromCat === "Sem categoria";
    const query = supabase.from("expenses").update({ category: bulkNewCat });
    const { error } = isUncat
      ? await query.is("category", null)
      : await query.eq("category", fromCat);
    if (error) {
      toast.error("Falha ao reclassificar.");
    } else {
      toast.success(`${bulkTarget.count} ${bulkTarget.count === 1 ? "despesa movida" : "despesas movidas"} para ${bulkNewCat}.`);
      setExpenses((prev) =>
        prev.map((e) => ((isUncat ? !e.category : e.category === fromCat) ? { ...e, category: bulkNewCat } : e)),
      );
      window.dispatchEvent(new CustomEvent("aura:data-changed"));
    }
    setBulkSaving(false);
    setBulkTarget(null);
    setBulkNewCat("");
  };

  useEffect(() => {
    const load = () => {
      supabase
        .from("expense_items")
        .select("normalized_name,raw_name,category,quantity,unit,total_price,expense_id")
        .then(({ data }) => setItems((data ?? []) as ItemRow[]));
      supabase
        .from("expenses")
        .select("id,merchant_name,category,total_amount")
        .then(({ data }) => setExpenses((data ?? []) as ExpenseRow[]));
    };
    load();
    window.addEventListener("aura:data-changed", load);
    return () => window.removeEventListener("aura:data-changed", load);
  }, []);

  // Mapa expense_id → categoria de estabelecimento (para filtrar itens)
  const expCategoryById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of expenses) m.set(e.id, e.category || "Sem categoria");
    return m;
  }, [expenses]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const e of expenses) set.add(e.category || "Sem categoria");
    return Array.from(set).sort();
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    if (filter === "all") return expenses;
    return expenses.filter((e) => (e.category || "Sem categoria") === filter);
  }, [expenses, filter]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((it) => expCategoryById.get(it.expense_id) === filter);
  }, [items, expCategoryById, filter]);

  const byProduct = useMemo(() => {
    const m = new Map<string, { total: number; qty: number; unit: string | null }>();
    for (const it of filteredItems) {
      const k = it.normalized_name || it.raw_name;
      const v = m.get(k) ?? { total: 0, qty: 0, unit: it.unit };
      v.total += Number(it.total_price);
      v.qty += Number(it.quantity);
      m.set(k, v);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  }, [filteredItems]);

  const byExpenseCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filteredExpenses) {
      const k = r.category || "Sem categoria";
      m.set(k, (m.get(k) ?? 0) + Number(r.total_amount));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  const byItemCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of filteredItems) {
      const k = it.category || it.normalized_name || "Outros";
      m.set(k, (m.get(k) ?? 0) + Number(it.total_price));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredItems]);

  return (
    <>
      <PageHeader eyebrow="Consumo" title="O que você compra" />

      <div className="flex items-center gap-2 mb-4">
        <Filter className="size-4 text-muted-foreground shrink-0" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="rounded-xl h-9 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {allCategories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>


      <section className="mb-4">
        <h2 className="font-display font-semibold mb-2 text-sm">Por tipo de estabelecimento</h2>
        <div className="space-y-2">
          {byExpenseCategory.slice(0, 6).map(([cat, total]) => (
            <div key={cat} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-card border border-border rounded-2xl p-3 sm:p-4">
              <p className="text-sm font-semibold truncate">{cat}</p>
              <p className="text-sm font-bold">{brl(total)}</p>
            </div>
          ))}
          {byExpenseCategory.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma despesa registrada ainda.</p>
          )}
        </div>
      </section>

      <section className="mb-4">
        <h2 className="font-display font-semibold mb-2 text-sm">Categorias de produtos</h2>
        <div className="space-y-2">
          {byItemCategory.slice(0, 6).map(([cat, total]) => (
            <div key={cat} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-card border border-border rounded-2xl p-3 sm:p-4">
              <p className="text-sm font-semibold truncate">{cat}</p>
              <p className="text-sm font-bold">{brl(total)}</p>
            </div>
          ))}
          {byItemCategory.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum item registrado ainda.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-display font-semibold mb-2 text-sm">Produtos mais consumidos</h2>
        <div className="space-y-2">
          {byProduct.map(([prod, v]) => (
            <div key={prod} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-card border border-border rounded-2xl p-3 sm:p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{prod}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
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
