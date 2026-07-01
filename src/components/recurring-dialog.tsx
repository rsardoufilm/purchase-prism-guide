import { useEffect, useState, type ReactNode } from "react";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { paymentLabel, brl } from "@/lib/format";
import {
  generateCycleDates,
  startOfDay,
  toISODate,
  cycleLabel,
  type Frequency,
} from "@/lib/recurring-cycles";

const FREQS: Frequency[] = ["mensal", "bimestral", "trimestral", "semestral", "anual"];

export interface EditableRecurring {
  id: string;
  name: string;
  category: string | null;
  amount: number;
  due_day: number | null;
  frequency: string;
  payment_method?: string | null;
  start_date?: string | null;
}

interface RecurringDialogProps {
  trigger?: ReactNode;
  onSaved?: () => void;
  editing?: EditableRecurring | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function RecurringDialog({
  trigger,
  onSaved,
  editing,
  open: openProp,
  onOpenChange,
}: RecurringDialogProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (openProp === undefined) setOpenState(v);
  };

  const isEdit = !!editing;
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("mensal");
  const [payment, setPayment] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(toISODate(new Date()));
  const [saving, setSaving] = useState(false);

  // Prompt retroativo
  const [pending, setPending] = useState<null | {
    id: string;
    userId: string;
    name: string;
    amount: number;
    category: string | null;
    payment: string | null;
    missing: Date[];
  }>(null);
  const [creatingRetro, setCreatingRetro] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setAmount(editing ? String(editing.amount) : "");
    setDueDay(editing?.due_day ? String(editing.due_day) : "");
    setFrequency(((editing?.frequency as Frequency) ?? "mensal") as Frequency);
    setPayment(editing?.payment_method ?? "");
    setCategory(editing?.category ?? "");
    setStartDate(editing?.start_date ?? toISODate(new Date()));
  }, [open, editing]);

  const save = async () => {
    if (!name.trim() || !amount) {
      toast.error("Preencha nome e valor.");
      return;
    }
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const uid = user.user!.id;
    const payload = {
      name: name.trim(),
      amount: Number(amount),
      due_day: dueDay ? Number(dueDay) : null,
      frequency,
      payment_method: payment || null,
      category: category || null,
      start_date: startDate,
    };
    if (isEdit) {
      const { error } = await supabase
        .from("recurring_expenses")
        .update({ ...payload, editado_em: new Date().toISOString(), editado_por: uid })
        .eq("id", editing!.id);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Conta atualizada.");
      setOpen(false);
      onSaved?.();
      window.dispatchEvent(new CustomEvent("aura:data-changed"));
      return;
    }

    // Criação
    const { data: created, error } = await supabase
      .from("recurring_expenses")
      .insert({ ...payload, user_id: uid })
      .select("id")
      .single();
    setSaving(false);
    if (error || !created) {
      toast.error(error?.message ?? "Erro ao criar recorrente.");
      return;
    }

    // Detectar ciclos retroativos (start_date anterior ao mês atual).
    const start = startOfDay(new Date(startDate + "T00:00:00"));
    const today = startOfDay(new Date());
    const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (start < firstOfThisMonth) {
      // Fim: último ciclo antes do mês atual
      const endMissing = new Date(firstOfThisMonth);
      endMissing.setDate(endMissing.getDate() - 1);
      const all = generateCycleDates(start, endMissing, frequency, payload.due_day);
      if (all.length > 0) {
        setPending({
          id: created.id,
          userId: uid,
          name: payload.name,
          amount: payload.amount,
          category: payload.category,
          payment: payload.payment_method,
          missing: all,
        });
        toast.success("Conta criada. Confira as parcelas em aberto.");
        onSaved?.();
        window.dispatchEvent(new CustomEvent("aura:data-changed"));
        return;
      }
    }

    toast.success("Conta recorrente criada.");
    setOpen(false);
    onSaved?.();
    window.dispatchEvent(new CustomEvent("aura:data-changed"));
  };

  const launchRetro = async () => {
    if (!pending) return;
    setCreatingRetro(true);
    try {
      for (const d of pending.missing) {
        const iso = toISODate(d);
        const { data: exp, error: expErr } = await supabase
          .from("expenses")
          .insert({
            user_id: pending.userId,
            expense_date: iso,
            merchant_name: pending.name,
            category: pending.category,
            payment_method: (pending.payment as never) || ("outros" as never),
            total_amount: pending.amount,
            source: "manual" as never,
            notes: `Lançamento retroativo do recorrente "${pending.name}".`,
          })
          .select("id")
          .single();
        if (expErr) throw expErr;
        const { error: cycErr } = await supabase.from("recurring_cycles").insert({
          recurring_id: pending.id,
          user_id: pending.userId,
          cycle_date: iso,
          amount: pending.amount,
          expense_id: exp!.id,
          confirmed_at: new Date().toISOString(),
        });
        if (cycErr) throw cycErr;
      }
      toast.success(`${pending.missing.length} parcela(s) lançada(s) no histórico.`);
      setPending(null);
      setOpen(false);
      window.dispatchEvent(new CustomEvent("aura:data-changed"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao lançar parcelas.");
    } finally {
      setCreatingRetro(false);
    }
  };

  const skipRetro = () => {
    setPending(null);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold mb-5 gap-2">
              <Plus className="size-4" /> Nova conta recorrente
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        {pending ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="size-5 text-primary" />
                Lançamentos retroativos
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>
                Identificamos que <strong>{pending.name}</strong> tem{" "}
                <strong>{pending.missing.length} parcela(s)</strong> não registradas desde{" "}
                <strong>{cycleLabel(pending.missing[0])}</strong>. Deseja lançar retroativamente?
              </p>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-muted/30 p-3 space-y-1">
                {pending.missing.map((d) => (
                  <div key={d.toISOString()} className="flex justify-between text-xs">
                    <span>{cycleLabel(d)}</span>
                    <span className="font-mono">{brl(pending.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={skipRetro} disabled={creatingRetro}>
                Agora não
              </Button>
              <Button onClick={launchRetro} disabled={creatingRetro}>
                {creatingRetro && <Loader2 className="size-4 mr-2 animate-spin" />}
                Lançar {pending.missing.length} parcela(s)
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {isEdit ? "Editar conta recorrente" : "Nova conta recorrente"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Field label="Nome">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Conta de luz"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor">
                  <Input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
                <Field label="Dia vencim.">
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Frequência">
                  <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Pagamento">
                  <Select value={payment} onValueChange={setPayment}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(paymentLabel).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Data de início">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Field>
              {!isEdit && (
                <p className="text-[10px] text-muted-foreground">
                  Se a data for anterior ao mês atual, você poderá lançar as parcelas em aberto.
                </p>
              )}
              {isEdit && (
                <p className="text-[10px] text-muted-foreground">
                  Alterações são registradas no histórico do item (editado_em / editado_por).
                </p>
              )}
              <Button onClick={save} disabled={saving} className="w-full">
                {saving && <Loader2 className="size-4 mr-2 animate-spin" />}Salvar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
