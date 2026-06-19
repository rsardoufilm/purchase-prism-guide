import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { brl, fmtDate, paymentLabel } from "@/lib/format";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/despesas")({
  component: Despesas,
  head: () => ({ meta: [{ title: "Despesas — AURA Finance" }] }),
});

interface Row {
  id: string;
  merchant_name: string;
  category: string | null;
  expense_date: string;
  total_amount: number;
  payment_method: string;
}

function Despesas() {
  const location = useLocation();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase
      .from("expenses")
      .select("id,merchant_name,category,expense_date,total_amount,payment_method")
      .order("expense_date", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);
  if (location.pathname !== "/despesas") {
    return <Outlet />;
  }

  return (
    <>
      <PageHeader eyebrow="Despesas" title="Suas despesas" />
      <Button asChild className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold gap-2 mb-5">
        <Link to="/despesas/nova" onClick={() => console.log("[PLUS_CLICK] navegando para /despesas/nova") }>
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
            <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-card p-4 rounded-2xl border border-border">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{r.merchant_name}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {fmtDate(r.expense_date)} • {paymentLabel[r.payment_method] ?? r.payment_method}
                  {r.category ? ` • ${r.category}` : ""}
                </p>
              </div>
              <p className="text-sm font-bold">{brl(Number(r.total_amount))}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
