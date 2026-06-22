import { useState, type ReactNode } from "react";
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

const FREQS = ["mensal", "bimestral", "trimestral", "semestral", "anual"] as const;
type Freq = (typeof FREQS)[number];

interface SubscriptionDialogProps {
  trigger?: ReactNode;
  onCreated?: () => void;
}

export function SubscriptionDialog({ trigger, onCreated }: SubscriptionDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Freq>("mensal");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !amount) {
      toast.error("Preencha nome e valor.");
      return;
    }
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("subscriptions").insert({
      user_id: user.user!.id,
      name: name.trim(),
      amount: Number(amount),
      frequency,
      next_due_date: due || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Assinatura criada.");
    setOpen(false);
    setName("");
    setAmount("");
    setDue("");
    onCreated?.();
    window.dispatchEvent(new CustomEvent("aura:data-changed"));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold mb-5 gap-2">
            <Plus className="size-4" /> Nova assinatura
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova assinatura</DialogTitle>
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
