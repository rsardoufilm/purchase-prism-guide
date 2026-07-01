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

export interface EditableSubscription {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  next_due_date: string | null;
  category?: string | null;
  payment_method?: string | null;
}

interface SubscriptionDialogProps {
  trigger?: ReactNode;
  onCreated?: () => void;
  onSaved?: () => void;
  editing?: EditableSubscription | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SubscriptionDialog({
  trigger,
  onCreated,
  onSaved,
  editing,
  open: openProp,
  onOpenChange,
}: SubscriptionDialogProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (openProp === undefined) setOpenState(v);
  };

  const isEdit = !!editing;
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Freq>("mensal");
  const [due, setDue] = useState("");
  const [payment, setPayment] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setAmount(editing ? String(editing.amount) : "");
    setFrequency(((editing?.frequency as Freq) ?? "mensal") as Freq);
    setDue(editing?.next_due_date ?? "");
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
      amount: Number(amount),
      frequency,
      next_due_date: due || null,
      category: category || null,
      payment_method: payment || null,
    };
    const { error } = isEdit
      ? await supabase
          .from("subscriptions")
          .update({ ...payload, editado_em: new Date().toISOString(), editado_por: uid })
          .eq("id", editing!.id)
      : await supabase.from("subscriptions").insert({ ...payload, user_id: uid });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isEdit ? "Assinatura atualizada." : "Assinatura criada.");
    setOpen(false);
    onCreated?.();
    onSaved?.();
    window.dispatchEvent(new CustomEvent("aura:data-changed"));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold mb-5 gap-2">
              <Plus className="size-4" /> Nova assinatura
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar assinatura" : "Nova assinatura"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Nome">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Netflix Premium"
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
          </div>
          <Field label="Próximo vencimento">
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
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
          {isEdit && editing?.id && (
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
