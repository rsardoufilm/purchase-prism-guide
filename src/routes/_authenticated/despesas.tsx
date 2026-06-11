import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { brl, fmtDateTime, paymentLabel } from "@/lib/format";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/despesas")({
  component: Despesas,
  head: () => ({ meta: [{ title: "Despesas — AURA Finance" }] }),
});

interface Row {
  id: string;
  merchant: string;
  category: string | null;
  purchased_at: string;
  total: number;
  payment_method: string;
}

function Despesas() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase
      .from("receipts")
      .select("id,merchant,category,purchased_at,total,payment_method")
      .order("purchased_at", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);
  return (
    <>
      <PageHeader eyebrow="Despesas" title="Suas notas fiscais" />
      <Link to="/despesas/nova" className="block mb-5">
        <Button className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold gap-2">
          <Plus className="size-4" /> Nova despesa (manual ou OCR)
        </Button>
      </Link>
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
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-card p-4 rounded-2xl border border-border"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{r.merchant}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {fmtDateTime(r.purchased_at)} • {paymentLabel[r.payment_method] ?? r.payment_method}
                  {r.category ? ` • ${r.category}` : ""}
                </p>
              </div>
              <p className="text-sm font-bold">{brl(Number(r.total))}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
