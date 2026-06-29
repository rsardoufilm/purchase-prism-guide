import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { TourGuide } from "@/components/tour-guide";
import { TOURS } from "@/lib/tours";
import { SubscriptionDialog } from "@/components/subscription-dialog";
import { brl } from "@/lib/format";
import { CalendarClock, Loader2, Trash2 } from "lucide-react";
import {
  parseDateLocal,
  projectSubscriptionOccurrences,
  SUBSCRIPTION_HORIZON_MONTHS,
  type SubscriptionOccurrence as Occurrence,
  type SubscriptionRow as Sub,
} from "@/lib/subscriptions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assinaturas")({
  component: Assinaturas,
  head: () => ({ meta: [{ title: "Assinaturas — AURA Consumo" }] }),
});

const HORIZON_MONTHS = SUBSCRIPTION_HORIZON_MONTHS;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date) {
  return d
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^./, (c) => c.toUpperCase());
}

function Assinaturas() {
  const [rows, setRows] = useState<Sub[]>([]);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  const load = () =>
    supabase
      .from("subscriptions")
      .select("id,name,amount,frequency,next_due_date")
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Sub[]));

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener("aura:data-changed", onChange);
    return () => window.removeEventListener("aura:data-changed", onChange);
  }, []);

  const handleDelete = async (id: string, name: string) => {
    const ok = window.confirm(`Deseja excluir a assinatura "${name}"?`);
    if (!ok) return;
    setDeleting((prev) => new Set(prev).add(id));
    const { error } = await supabase.from("subscriptions").delete().eq("id", id);
    setDeleting((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Assinatura excluída.");
    window.dispatchEvent(new CustomEvent("aura:data-changed"));
    load();
  };

  const occurrences = useMemo(() => projectSubscriptionOccurrences(rows), [rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; total: number; items: Occurrence[] }>();
    for (const o of occurrences) {
      const k = monthKey(o.date);
      if (!map.has(k)) map.set(k, { label: monthLabel(o.date), total: 0, items: [] });
      const g = map.get(k)!;
      g.total += o.amount;
      g.items.push(o);
    }
    return Array.from(map.entries());
  }, [occurrences]);

  const horizonTotal = useMemo(
    () => occurrences.reduce((s, o) => s + o.amount, 0),
    [occurrences],
  );

  return (
    <>
      <PageHeader eyebrow="Assinaturas" title="Recorrências fixas" tourKey="assinaturas" />
      <TourGuide tourKey="assinaturas" steps={TOURS.assinaturas} />
      <SubscriptionDialog onCreated={load} />

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma assinatura cadastrada.</p>
      ) : (
        <>
          <div className="space-y-2 mb-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Cadastradas ({rows.length})
            </h2>
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 items-center bg-card border border-border rounded-2xl p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{r.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.frequency}
                    {r.next_due_date
                      ? ` • próx. ${parseDateLocal(r.next_due_date).toLocaleDateString("pt-BR")}`
                      : ""}
                  </p>
                </div>
                <p className="text-sm font-bold">{brl(Number(r.amount))}</p>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id, r.name)}
                  disabled={deleting.has(r.id)}
                  aria-label={`Excluir assinatura ${r.name}`}
                  className={cn(
                    "p-2 rounded-xl transition-colors",
                    "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                >
                  {deleting.has(r.id) ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              </div>
            ))}
          </div>

          <section>
            <div className="flex items-center justify-between px-1 mb-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-primary" />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Próximos {HORIZON_MONTHS} meses
                </h2>
              </div>
              <span className="text-[11px] font-bold tabular-nums">{brl(horizonTotal)}</span>
            </div>

            {grouped.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1">
                Defina o próximo vencimento de cada assinatura para projetar os lançamentos.
              </p>
            ) : (
              <div className="space-y-4">
                {grouped.map(([k, g]) => (
                  <div key={k} className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
                      <p className="text-xs font-semibold">{g.label}</p>
                      <p className="text-xs font-bold tabular-nums">{brl(g.total)}</p>
                    </div>
                    <ul className="divide-y divide-border">
                      {g.items.map((o, i) => (
                        <li
                          key={`${o.subId}-${i}`}
                          className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center px-4 py-2.5"
                        >
                          <span className="text-[10px] font-semibold tabular-nums text-muted-foreground w-9">
                            {String(o.date.getDate()).padStart(2, "0")}/
                            {String(o.date.getMonth() + 1).padStart(2, "0")}
                          </span>
                          <span className="text-sm truncate">{o.name}</span>
                          <span className="text-sm font-semibold tabular-nums">
                            {brl(o.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
