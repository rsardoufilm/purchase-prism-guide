import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { SubscriptionDialog } from "@/components/subscription-dialog";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/assinaturas")({
  component: Assinaturas,
  head: () => ({ meta: [{ title: "Assinaturas — AURA Consumo" }] }),
});

interface Sub {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  next_due_date: string | null;
}

function Assinaturas() {
  const [rows, setRows] = useState<Sub[]>([]);

  const load = () =>
    supabase
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Sub[]));

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener("aura:data-changed", onChange);
    return () => window.removeEventListener("aura:data-changed", onChange);
  }, []);

  return (
    <>
      <PageHeader eyebrow="Assinaturas" title="Recorrências fixas" />
      <SubscriptionDialog onCreated={load} />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma assinatura cadastrada.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-card border border-border rounded-2xl p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{r.name}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {r.frequency}
                  {r.next_due_date
                    ? ` • venc. ${new Date(r.next_due_date).toLocaleDateString("pt-BR")}`
                    : ""}
                </p>
              </div>
              <p className="text-sm font-bold">{brl(Number(r.amount))}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
