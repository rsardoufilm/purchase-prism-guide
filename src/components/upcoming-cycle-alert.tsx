import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Loader2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  daysBetween,
  nextDueDate,
  startOfDay,
  toISODate,
  cycleLabel,
  type Frequency,
} from "@/lib/recurring-cycles";

interface Props {
  recurringId: string;
  userId: string;
  name: string;
  defaultAmount: number;
  frequency: Frequency;
  dueDay: number | null;
  startDate: string; // YYYY-MM-DD
  onResolved: () => void;
}

/**
 * Card exibido 5 dias antes do vencimento, pedindo confirmação do valor
 * para o ciclo atual. Uma correção salva um override apenas no ciclo,
 * sem alterar o valor padrão dos ciclos futuros.
 */
export function UpcomingCycleAlert({
  recurringId,
  userId,
  name,
  defaultAmount,
  frequency,
  dueDay,
  startDate,
  onResolved,
}: Props) {
  const start = useMemo(() => startOfDay(new Date(startDate + "T00:00:00")), [startDate]);
  const today = startOfDay(new Date());
  const next = useMemo(
    () => nextDueDate(start, today, frequency, dueDay),
    [start, today, frequency, dueDay],
  );

  const [existing, setExisting] = useState<{ id: string; amount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(defaultAmount));
  const [saving, setSaving] = useState(false);

  const cycleIso = next ? toISODate(next) : null;
  const daysLeft = next ? daysBetween(today, next) : Infinity;
  const inWindow = next !== null && daysLeft <= 5 && daysLeft >= 0;

  useEffect(() => {
    if (!cycleIso || !inWindow) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("recurring_cycles")
      .select("id,amount")
      .eq("recurring_id", recurringId)
      .eq("cycle_date", cycleIso)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setExisting(data ? { id: data.id, amount: Number(data.amount) } : null);
        setAmount(data ? String(data.amount) : String(defaultAmount));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cycleIso, inWindow, recurringId, defaultAmount]);

  if (!inWindow || loading) return null;
  if (existing?.amount != null) return null; // já confirmado/corrigido

  const persist = async (value: number) => {
    if (!cycleIso) return;
    setSaving(true);
    const { error } = await supabase.from("recurring_cycles").upsert(
      {
        recurring_id: recurringId,
        user_id: userId,
        cycle_date: cycleIso,
        amount: value,
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: "recurring_id,cycle_date" },
    );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Valor confirmado para este ciclo.");
    onResolved();
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <AlertCircle className="size-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs leading-snug">
          <strong>{name}</strong> vence em{" "}
          <strong>
            {daysLeft} dia{daysLeft === 1 ? "" : "s"}
          </strong>{" "}
          ({cycleLabel(next!)}). O valor continua <strong>{brl(defaultAmount)}</strong>?
        </p>
      </div>
      {editing ? (
        <div className="flex gap-2">
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9"
          />
          <Button
            size="sm"
            className="h-9"
            disabled={saving || !amount}
            onClick={() => persist(Number(amount))}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 flex-1"
            disabled={saving}
            onClick={() => persist(defaultAmount)}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Check className="size-4 mr-1" /> Confirmar
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 flex-1"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4 mr-1" /> Corrigir valor
          </Button>
        </div>
      )}
    </div>
  );
}
