import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recorrentes")({
  component: Recorrentes,
  head: () => ({ meta: [{ title: "Recorrentes — AURA Consumo" }] }),
});

interface Bill { id: string; name: string; category: string | null; amount: number; due_day: number | null; frequency: string }
const FREQS = ["mensal","bimestral","trimestral","semestral","anual"] as const;
type Freq = typeof FREQS[number];

function Recorrentes() {
  const [rows, setRows] = useState<Bill[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [frequency, setFrequency] = useState<Freq>("mensal");
  const [saving, setSaving] = useState(false);

  const load = () =>
    supabase.from("recurring_expenses").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Bill[]));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!name.trim() || !amount) { toast.error("Preencha nome e valor."); return; }
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("recurring_expenses").insert({
      user_id: user.user!.id,
      name: name.trim(),
      category: category || null,
      amount: Number(amount),
      due_day: dueDay ? Number(dueDay) : null,
      frequency,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta recorrente criada.");
    setOpen(false); setName(""); setCategory(""); setAmount(""); setDueDay("");
    load();
  };

  return (
    <>
      <PageHeader eyebrow="Recorrentes" title="Contas fixas" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold mb-5 gap-2">
            <Plus className="size-4" /> Nova conta recorrente
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova conta recorrente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Conta de luz" /></Field>
            <Field label="Categoria"><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Energia" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor"><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
              <Field label="Dia vencim."><Input type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} /></Field>
            </div>
            <Field label="Frequência">
              <Select value={frequency} onValueChange={(v) => setFrequency(v as Freq)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FREQS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Button onClick={save} disabled={saving} className="w-full">{saving && <Loader2 className="size-4 mr-2 animate-spin" />}Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma conta recorrente.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-card border border-border rounded-2xl p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{r.name}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {r.frequency}{r.due_day ? ` • dia ${r.due_day}` : ""}{r.category ? ` • ${r.category}` : ""}
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
  return <div className="space-y-1.5"><Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>{children}</div>;
}
