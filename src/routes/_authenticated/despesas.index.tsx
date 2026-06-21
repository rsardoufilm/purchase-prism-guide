import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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

function DespesasIndex() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

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
  }, []);

  const handleNewExpenseTouch = () => {
    console.log("[NEW_EXPENSE_TOUCH] toque recebido no botão Nova despesa");
    toast.message("Abrindo nova despesa…");
  };

  const handleNewExpenseClick = () => {
    console.log("[NEW_EXPENSE_CLICK] navegando para /despesas/nova");
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
      // expense_items tem FK ON DELETE CASCADE via RLS própria; remover na ordem segura.
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

  return (
    <>
      <PageHeader eyebrow="Despesas" title="Suas despesas" />
      <Button asChild className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold gap-2 mb-5">
        <Link to="/despesas/nova" onPointerDown={handleNewExpenseTouch} onClick={handleNewExpenseClick}>
          <Plus className="size-4" /> Nova despesa
        </Link>
      </Button>
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma despesa ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 bg-card p-4 rounded-2xl border border-border items-center"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{r.merchant_name}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {fmtDate(r.expense_date)} • {paymentLabel[r.payment_method] ?? r.payment_method}
                  {r.category ? ` • ${r.category}` : ""}
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
