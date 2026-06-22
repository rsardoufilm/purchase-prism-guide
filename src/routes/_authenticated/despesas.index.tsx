import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Filter, AlertTriangle, CheckSquare, Square, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { PeriodFilter } from "@/components/period-filter";
import { periodRange } from "@/lib/period";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
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
import { brl, fmtDate, paymentLabel } from "@/lib/format";
import { MERCHANT_CATEGORY_OPTIONS } from "@/lib/classifier";
import { toast } from "sonner";
import { useSharedPeriod } from "@/hooks/use-shared-period";

export const Route = createFileRoute("/_authenticated/despesas/")({
  component: DespesasIndex,
  head: () => ({ meta: [{ title: "Despesas — AURA Consumo" }] }),
});

interface Row {
  id: string;
  merchant_name: string;
  category: string | null;
  expense_date: string;
  total_amount: number;
  payment_method: string;
}

const FILTER_KEY = "aura:despesas:filter-category";

function isoDate(d: Date | null) { return d ? d.toISOString().slice(0, 10) : null; }

function DespesasIndex() {
  const navigate = useNavigate();
  const [period, setPeriod] = useSharedPeriod();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "all";
    return window.localStorage.getItem(FILTER_KEY) ?? "all";
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState<string>("");
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(FILTER_KEY, filter);
  }, [filter]);

  const load = () => {
    setLoading(true);
    supabase
      .from("expenses")
      .select("id,merchant_name,category,expense_date,total_amount,payment_method")
      .order("expense_date", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener("aura:data-changed", onChange);
    return () => window.removeEventListener("aura:data-changed", onChange);
  }, []);

  const handleNewExpenseTouch = () => toast.message("Abrindo nova despesa…");
  const handleNewExpenseClick = () => {
    window.setTimeout(() => {
      if (window.location.pathname !== "/despesas/nova") navigate({ to: "/despesas/nova" });
    }, 350);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const { error: e1 } = await supabase.from("expense_items").delete().eq("expense_id", pendingDelete.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("expenses").delete().eq("id", pendingDelete.id);
      if (e2) throw e2;
      toast.success("Despesa excluída.");
      setRows((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      window.dispatchEvent(new CustomEvent("aura:data-changed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir.");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const reclassify = async (row: Row, newCat: string) => {
    const prev = row.category;
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, category: newCat } : x)));
    const { error } = await supabase.from("expenses").update({ category: newCat }).eq("id", row.id);
    if (error) {
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, category: prev } : x)));
      toast.error("Falha ao reclassificar.");
    } else {
      toast.success(`Categoria atualizada: ${newCat}`);
      window.dispatchEvent(new CustomEvent("aura:data-changed"));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const applyBulk = async () => {
    if (!bulkCat || selected.size === 0) return;
    setBulkSaving(true);
    const ids = Array.from(selected);
    const prevSnapshot = new Map(rows.filter((r) => selected.has(r.id)).map((r) => [r.id, r.category]));
    setRows((r) => r.map((x) => (selected.has(x.id) ? { ...x, category: bulkCat } : x)));
    const { error } = await supabase.from("expenses").update({ category: bulkCat }).in("id", ids);
    if (error) {
      setRows((r) => r.map((x) => (prevSnapshot.has(x.id) ? { ...x, category: prevSnapshot.get(x.id) ?? null } : x)));
      toast.error("Falha na reclassificação em lote.");
    } else {
      toast.success(`${ids.length} ${ids.length === 1 ? "despesa reclassificada" : "despesas reclassificadas"} como ${bulkCat}.`);
      clearSelection();
      setBulkCat("");
      window.dispatchEvent(new CustomEvent("aura:data-changed"));
    }
    setBulkSaving(false);
  };

  const categoriesPresent = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.category && set.add(r.category));
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "__uncat__") return rows.filter((r) => !r.category);
    return rows.filter((r) => r.category === filter);
  }, [rows, filter]);

  const uncategorizedCount = useMemo(() => rows.filter((r) => !r.category).length, [rows]);

  return (
    <>
      <PageHeader eyebrow="Despesas" title="Suas despesas" />
      <Button asChild className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-semibold gap-2 mb-3">
        <Link to="/despesas/nova" onPointerDown={handleNewExpenseTouch} onClick={handleNewExpenseClick}>
          <Plus className="size-4" /> Nova despesa
        </Link>
      </Button>

      {uncategorizedCount > 0 && filter !== "__uncat__" && (
        <button
          type="button"
          onClick={() => setFilter("__uncat__")}
          className="w-full flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-2xl p-3 mb-3 text-left hover:bg-amber-500/15 transition-colors"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <p className="text-xs font-medium flex-1">
            {uncategorizedCount} {uncategorizedCount === 1 ? "despesa sem categoria" : "despesas sem categoria"} — clique para filtrar e organizar.
          </p>
        </button>
      )}

      <div className="flex items-center gap-2 mb-3">
        <Filter className="size-4 text-muted-foreground shrink-0" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="rounded-xl h-9 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            <SelectItem value="__uncat__">Sem categoria{uncategorizedCount ? ` (${uncategorizedCount})` : ""}</SelectItem>
            {categoriesPresent.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filteredRows.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {rows.length === 0 ? "Nenhuma despesa ainda." : "Nenhuma despesa nesta categoria."}
          </p>
        </div>
      ) : (
        <div className="space-y-2 pb-24">
          {filteredRows.map((r) => {
            const isSelected = selected.has(r.id);
            const noCat = !r.category;
            return (
              <div
                key={r.id}
                className={`bg-card p-3 sm:p-4 rounded-2xl border space-y-2 ${isSelected ? "border-primary ring-1 ring-primary/40" : "border-border"}`}
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => toggleSelect(r.id)}
                    aria-label={isSelected ? "Desmarcar" : "Selecionar"}
                    className="size-7 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{r.merchant_name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">
                      {fmtDate(r.expense_date)} • {paymentLabel[r.payment_method] ?? r.payment_method}
                    </p>
                  </div>
                  <p className="text-sm font-bold whitespace-nowrap">{brl(Number(r.total_amount))}</p>
                  <Link
                    to="/despesas/nova"
                    search={{ id: r.id }}
                    aria-label={`Editar ${r.merchant_name}`}
                    className="size-9 grid place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="size-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(r)}
                    aria-label={`Excluir ${r.merchant_name}`}
                    className="size-9 grid place-items-center rounded-xl border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 pl-9">
                  {noCat && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      <AlertTriangle className="size-3" /> Sem categoria
                    </span>
                  )}
                  <Select value={r.category ?? ""} onValueChange={(v) => reclassify(r, v)}>
                    <SelectTrigger
                      className={`rounded-lg h-7 text-[11px] w-auto inline-flex gap-1 px-2 border-dashed ${noCat ? "border-amber-500/40 text-amber-700 dark:text-amber-400" : ""}`}
                      aria-label="Reclassificar categoria"
                    >
                      <SelectValue placeholder="Definir categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {MERCHANT_CATEGORY_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-24 md:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md bg-card border border-border rounded-2xl shadow-[var(--shadow-elevated)] p-3 flex items-center gap-2">
          <button
            type="button"
            onClick={clearSelection}
            aria-label="Limpar seleção"
            className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
          <span className="text-xs font-semibold whitespace-nowrap">
            {selected.size} {selected.size === 1 ? "selecionada" : "selecionadas"}
          </span>
          <Select value={bulkCat} onValueChange={setBulkCat}>
            <SelectTrigger className="rounded-lg h-9 text-xs flex-1">
              <SelectValue placeholder="Categoria…" />
            </SelectTrigger>
            <SelectContent>
              {MERCHANT_CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            disabled={!bulkCat || bulkSaving}
            onClick={applyBulk}
            className="h-9 rounded-lg text-xs px-3"
          >
            {bulkSaving && <Loader2 className="size-3.5 mr-1 animate-spin" />}
            Aplicar
          </Button>
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.merchant_name}" e todos os itens vinculados serão removidos. Esta ação não pode ser desfeita.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="size-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
