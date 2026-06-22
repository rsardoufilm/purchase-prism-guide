import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
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
import { Plus, Loader2 } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";

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
const FREQS = ["mensal", "bimestral", "trimestral", "semestral", "anual"] as const;
type Freq = (typeof FREQS)[number];

function Assinaturas() {
  const [rows, setRows] = useState<Sub[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Freq>("mensal");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    supabase
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Sub[]));
  useEffect(() => {
    load();
  }, []);

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
    load();
  };

  return (
    <>
      <PageHeader eyebrow="Assinaturas" title="Recorrências fixas" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold mb-5 gap-2">
            <Plus className="size-4" /> Nova assinatura
          </Button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
