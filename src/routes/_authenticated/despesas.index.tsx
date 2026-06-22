import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
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

function DespesasIndex() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "all";
    return window.localStorage.getItem(FILTER_KEY) ?? "all";
  });

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

  const handleNewExpenseTouch = () => {
    toast.message("Abrindo nova despesa…");
  };
  const handleNewExpenseClick = () => {
    window.setTimeout(() => {
      if (window.location.pathname !== "/despesas/nova") {
        navigate({ to: "/despesas/nova" });
      }
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
    const { error } = await supabase
      .from("expenses")
      .update({ category: newCat })
      .eq("id", row.id);
    if (error) {
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, category: prev } : x)));
      toast.error("Falha ao reclassificar.");
    } else {
      toast.success(`Categoria atualizada: ${newCat}`);
      window.dispatchEvent(new CustomEvent("aura:data-changed"));
    }
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

  return (
    <>
      <PageHeader eyebrow="Despesas" title="Suas despesas" />
      <Button asChild className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-semibold gap-2 mb-3">
        <Link to="/despesas/nova" onPointerDown={handleNewExpenseTouch} onClick={handleNewExpenseClick}>
          <Plus className="size-4" /> Nova despesa
        </Link>
      </Button>

      <div className="flex items-center gap-2 mb-3">
        <Filter className="size-4 text-muted-foreground shrink-0" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="rounded-xl h-9 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            <SelectItem value="__uncat__">Sem categoria</SelectItem>
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
        <div className="space-y-2">
          {filteredRows.map((r) => (
            <div
              key={r.id}
              className="bg-card p-3 sm:p-4 rounded-2xl border border-border space-y-2"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 items-center">
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
              <Select
                value={r.category ?? ""}
                onValueChange={(v) => reclassify(r, v)}
              >
                <SelectTrigger
                  className="rounded-lg h-7 text-[11px] w-auto inline-flex gap-1 px-2 border-dashed"
                  aria-label="Reclassificar categoria"
                >
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  {MERCHANT_CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
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
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
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
