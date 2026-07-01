import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { TourGuide } from "@/components/tour-guide";
import { TOURS } from "@/lib/tours";
import { brl } from "@/lib/format";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RecurringDialog, type EditableRecurring } from "@/components/recurring-dialog";
import { UpcomingCycleAlert } from "@/components/upcoming-cycle-alert";
import type { Frequency } from "@/lib/recurring-cycles";

export const Route = createFileRoute("/_authenticated/recorrentes")({
  component: Recorrentes,
  head: () => ({ meta: [{ title: "Recorrentes — AURA Consumo" }] }),
});

interface Bill {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  amount: number;
  due_day: number | null;
  frequency: string;
  payment_method: string | null;
  start_date: string;
}

function Recorrentes() {
  const [rows, setRows] = useState<Bill[]>([]);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditableRecurring | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = () =>
    supabase
      .from("recurring_expenses")
      .select("id,user_id,name,category,amount,due_day,frequency,payment_method,start_date")
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Bill[]));

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener("aura:data-changed", onChange);
    return () => window.removeEventListener("aura:data-changed", onChange);
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Deseja excluir "${name}"?`)) return;
    setDeleting((prev) => new Set(prev).add(id));
    const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
    setDeleting((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta excluída.");
    window.dispatchEvent(new CustomEvent("aura:data-changed"));
    load();
  };

  return (
    <>
      <PageHeader eyebrow="Recorrentes" title="Contas fixas" tourKey="recorrentes" />
      <TourGuide tourKey="recorrentes" steps={TOURS.recorrentes} />

      <RecurringDialog onSaved={load} />

      <RecurringDialog
        trigger={null}
        editing={editing}
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditing(null);
        }}
        onSaved={load}
      />

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma conta recorrente.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="bg-card border border-border rounded-2xl p-4 space-y-3"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 items-center">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{r.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.frequency}
                    {r.due_day ? ` • dia ${r.due_day}` : ""}
                    {r.category ? ` • ${r.category}` : ""}
                  </p>
                </div>
                <p className="text-sm font-bold whitespace-nowrap">{brl(Number(r.amount))}</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditing({
                      id: r.id,
                      name: r.name,
                      category: r.category,
                      amount: Number(r.amount),
                      due_day: r.due_day,
                      frequency: r.frequency,
                      payment_method: r.payment_method,
                      start_date: r.start_date,
                    });
                    setEditOpen(true);
                  }}
                  aria-label={`Editar ${r.name}`}
                  className="size-9 grid place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id, r.name)}
                  disabled={deleting.has(r.id)}
                  aria-label={`Excluir ${r.name}`}
                  className={cn(
                    "size-9 grid place-items-center rounded-xl border border-border transition-colors",
                    "text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5",
                  )}
                >
                  {deleting.has(r.id) ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              </div>
              <UpcomingCycleAlert
                key={`${r.id}-${reloadKey}`}
                recurringId={r.id}
                userId={r.user_id}
                name={r.name}
                defaultAmount={Number(r.amount)}
                frequency={r.frequency as Frequency}
                dueDay={r.due_day}
                startDate={r.start_date}
                onResolved={() => setReloadKey((k) => k + 1)}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
