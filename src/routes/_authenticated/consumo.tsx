import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Filter, Tag, Loader2, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { TourGuide } from "@/components/tour-guide";
import { TOURS } from "@/lib/tours";
import { PeriodFilter } from "@/components/period-filter";
import { periodRange } from "@/lib/period";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { brl } from "@/lib/format";
import { MERCHANT_CATEGORY_OPTIONS } from "@/lib/classifier";
import { toast } from "sonner";
import { useSharedPeriod } from "@/hooks/use-shared-period";
import { useSharedCategory } from "@/hooks/use-shared-category";
import { rankConsumption, rankMostExpensive } from "@/lib/consumption-ranking";

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
  expense_date: string;
}

function isoDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : null;
}

function RankingInfo({ title, body, example }: { title: string; body: string; example?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={title}
        className="text-muted-foreground hover:text-primary transition-colors"
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 text-xs leading-relaxed">
        <p className="font-semibold mb-1">{title}</p>
        <p className="text-muted-foreground">{body}</p>
        {example && (
          <>
            <p className="font-semibold mt-2 mb-1">Exemplo</p>
            <p className="text-muted-foreground">{example}</p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}


function Consumo() {
  const [period, setPeriod] = useSharedPeriod();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [filter, setFilter] = useSharedCategory();
  const [bulkTarget, setBulkTarget] = useState<{ from: string; count: number } | null>(null);
  const [bulkNewCat, setBulkNewCat] = useState<string>("");
  const [bulkSaving, setBulkSaving] = useState(false);

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
      toast.success(
        `${bulkTarget.count} ${bulkTarget.count === 1 ? "despesa movida" : "despesas movidas"} para ${bulkNewCat}.`,
      );
      setExpenses((prev) =>
        prev.map((e) =>
          (isUncat ? !e.category : e.category === fromCat) ? { ...e, category: bulkNewCat } : e,
        ),
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
        .select("id,merchant_name,category,total_amount,expense_date")
        .then(({ data }) => setExpenses((data ?? []) as ExpenseRow[]));
    };
    load();
    window.addEventListener("aura:data-changed", load);
    return () => window.removeEventListener("aura:data-changed", load);
  }, []);

  const { start, end } = periodRange(period);
  const s = isoDate(start);
  const e = isoDate(end);

  const filteredExpenses = useMemo(() => {
    let list = expenses;
    if (s) list = list.filter((x) => x.expense_date >= s);
    if (e) list = list.filter((x) => x.expense_date <= e);
    if (filter === "all") return list;
    if (filter === "__uncat__") return list.filter((x) => !x.category);
    return list.filter((x) => x.category === filter);
  }, [expenses, s, e, filter]);

  const filteredItems = useMemo(() => {
    const ids = new Set(filteredExpenses.map((x) => x.id));
    return items.filter((it) => ids.has(it.expense_id));
  }, [items, filteredExpenses]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const e of expenses) if (e.category) set.add(e.category);
    return Array.from(set).sort();
  }, [expenses]);

  const hasUncategorized = useMemo(() => expenses.some((e) => !e.category), [expenses]);

  const { byWeight, byUnit } = useMemo(() => rankConsumption(filteredItems, 8), [filteredItems]);
  const expensive = useMemo(() => rankMostExpensive(filteredItems, 8), [filteredItems]);

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
      <PageHeader eyebrow="Consumo" title="O que você compra" tourKey="consumo" />
      <TourGuide tourKey="consumo" steps={TOURS.consumo} />

      <div className="mb-3 animate-aura-in">
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Filter className="size-4 text-muted-foreground shrink-0" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="rounded-xl h-9 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {hasUncategorized && <SelectItem value="__uncat__">Sem categoria</SelectItem>}
            {allCategories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <section className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display font-semibold text-sm">Por tipo de estabelecimento</h2>
          <span className="text-[10px] text-muted-foreground">
            toque em <Tag className="inline size-3" /> para reclassificar
          </span>
        </div>
        <div className="space-y-2">
          {byExpenseCategory.slice(0, 8).map(([cat, total]) => {
            const count = filteredExpenses.filter(
              (e) => (e.category || "Sem categoria") === cat,
            ).length;
            return (
              <div
                key={cat}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 items-center bg-card border border-border rounded-2xl p-3 sm:p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{cat}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {count} {count === 1 ? "despesa" : "despesas"}
                  </p>
                </div>
                <p className="text-sm font-bold whitespace-nowrap">{brl(total)}</p>
                <button
                  type="button"
                  onClick={() => {
                    setBulkTarget({ from: cat, count });
                    setBulkNewCat("");
                  }}
                  aria-label={`Reclassificar ${cat}`}
                  className="size-8 grid place-items-center rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                >
                  <Tag className="size-3.5" />
                </button>
              </div>
            );
          })}
          {byExpenseCategory.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma despesa registrada ainda.</p>
          )}
        </div>
      </section>

      <section className="mb-4">
        <h2 className="font-display font-semibold mb-2 text-sm">Categorias de produtos</h2>
        <div className="space-y-2">
          {byItemCategory.slice(0, 6).map(([cat, total]) => (
            <div
              key={cat}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-card border border-border rounded-2xl p-3 sm:p-4"
            >
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
        <div className="flex items-center gap-1.5 mb-2">
          <h2 className="font-display font-semibold text-sm">Mais consumidos por peso</h2>
          <RankingInfo
            title="Como é calculado"
            body="Ordenado pelo peso total acumulado (kg) no período. Gramas viram kg automaticamente. O R$ aparece só como informação — não muda a posição."
            example="Arroz: 2 compras de 5 kg = 10 kg acumulado. Café: 500 g + 0,5 kg = 1 kg. Arroz fica acima mesmo se o café tiver custado mais."
          />
        </div>
        <div className="space-y-2">
          {byWeight.map(([prod, v]) => (
            <div
              key={`w-${prod}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-card border border-border rounded-2xl p-3 sm:p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{prod}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                  {v.qty.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg acumulado
                </p>
              </div>
              <p className="text-sm font-bold text-muted-foreground">{brl(v.total)}</p>
            </div>
          ))}
          {byWeight.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum produto por peso no período.</p>
          )}
        </div>
      </section>

      <section className="mt-4">
        <div className="flex items-center gap-1.5 mb-2">
          <h2 className="font-display font-semibold text-sm">Mais consumidos por unidade</h2>
          <RankingInfo
            title="Como é calculado"
            body="Ordenado pela quantidade de unidades acumuladas (un, pct, cx, etc.). Itens vendidos por peso ficam na lista acima. O R$ é apenas informativo."
            example="Iogurte: 20 un. Whisky: 1 un (R$ 500). Iogurte fica em 1º porque a lista ordena por quantidade, não por valor."
          />
        </div>
        <div className="space-y-2">
          {byUnit.map(([prod, v]) => (
            <div
              key={`u-${prod}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-card border border-border rounded-2xl p-3 sm:p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{prod}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                  {v.qty.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {v.unit} acumulado
                </p>
              </div>
              <p className="text-sm font-bold text-muted-foreground">{brl(v.total)}</p>
            </div>
          ))}
          {byUnit.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum produto por unidade no período.</p>
          )}
        </div>
      </section>

      <AlertDialog
        open={!!bulkTarget}
        onOpenChange={(o) => !o && !bulkSaving && setBulkTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reclassificar “{bulkTarget?.from}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkTarget?.count}{" "}
              {bulkTarget?.count === 1 ? "despesa será movida" : "despesas serão movidas"} para a
              nova categoria escolhida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={bulkNewCat} onValueChange={setBulkNewCat}>
            <SelectTrigger className="rounded-xl h-10 text-sm">
              <SelectValue placeholder="Escolher nova categoria…" />
            </SelectTrigger>
            <SelectContent>
              {MERCHANT_CATEGORY_OPTIONS.filter((c) => c !== bulkTarget?.from).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                reclassifyCategory();
              }}
              disabled={bulkSaving || !bulkNewCat}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {bulkSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
              Aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
