import { useEffect, useState, type ReactNode } from "react";
import { Plus, Loader2 } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { paymentLabel } from "@/lib/format";

const FREQS = ["mensal", "bimestral", "trimestral", "semestral", "anual"] as const;
type Freq = (typeof FREQS)[number];

export interface EditableRecurring {
  id: string;
  name: string;
  category: string | null;
  amount: number;
  due_day: number | null;
  frequency: string;
  payment_method?: string | null;
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
  const [frequency, setFrequency] = useState<Freq>("mensal");
  const [payment, setPayment] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setAmount(editing ? String(editing.amount) : "");
    setDueDay(editing?.due_day ? String(editing.due_day) : "");
    setFrequency(((editing?.frequency as Freq) ?? "mensal") as Freq);
    setPayment(editing?.payment_method ?? "");
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
      category: category || null,
      amount: Number(amount),
      due_day: dueDay ? Number(dueDay) : null,
      frequency,
      payment_method: payment || null,
    };
    const { error } = isEdit
      ? await supabase
          .from("recurring_expenses")
          .update({ ...payload, editado_em: new Date().toISOString(), editado_por: uid })
          .eq("id", editing!.id)
      : await supabase.from("recurring_expenses").insert({ ...payload, user_id: uid });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isEdit ? "Conta atualizada." : "Conta recorrente criada.");
    setOpen(false);
    onSaved?.();
    window.dispatchEvent(new CustomEvent("aura:data-changed"));
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
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar conta recorrente" : "Nova conta recorrente"}</DialogTitle>
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
              <Select value={frequency} onValueChange={(v) => setFrequency(v as Freq)}>
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
          {isEdit && (
            <p className="text-[10px] text-muted-foreground">
              Alterações são registradas no histórico do item (editado_em / editado_por).
            </p>
          )}
          <Button onClick={save} disabled={saving} className="w-full">
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}Salvar
          </Button>
        </div>
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
