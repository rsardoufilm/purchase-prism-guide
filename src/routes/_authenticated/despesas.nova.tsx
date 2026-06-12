import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ScanLine, Upload, Trash2 } from "lucide-react";
import { ocrReceipt, type OcrResult } from "@/lib/ocr.functions";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/despesas/nova")({
  component: NovaDespesa,
  head: () => ({ meta: [{ title: "Nova despesa — AURA Finance" }] }),
});

const PAYMENTS = ["pix","credito","debito","dinheiro","vale_alimentacao","vale_refeicao","outros"] as const;
const PAYMENT_LABELS: Record<string,string> = {
  pix:"PIX", credito:"Crédito", debito:"Débito", dinheiro:"Dinheiro",
  vale_alimentacao:"Vale Alimentação", vale_refeicao:"Vale Refeição", outros:"Outros",
};
const RECUR_CATEGORIES = ["energia","água","internet","telefonia","streaming","luz"];

type Source = "manual" | "photo" | "pdf";

function todayISO() { return new Date().toISOString().slice(0, 10); }

function NovaDespesa() {
  const navigate = useNavigate();
  const runOcr = useServerFn(ocrReceipt);
  const [source, setSource] = useState<Source>("manual");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<OcrResult | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (file.size > 12_000_000) { toast.error("Arquivo muito grande (máx. 12MB)."); return; }
    setScanning(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");

      const now = new Date();
      const ext = file.name.split(".").pop() || (file.type === "application/pdf" ? "pdf" : "jpg");
      const path = `${userId}/${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,"0")}/${crypto.randomUUID()}.${ext}`;

      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = () => rej(fr.error);
        fr.readAsDataURL(file);
      });

      // Upload + OCR em paralelo
      const [{ error: upErr }, result] = await Promise.all([
        supabase.storage.from("receipts").upload(path, file, { contentType: file.type, upsert: false }),
        runOcr({ data: { fileDataUrl: dataUrl, mimeType: file.type } }),
      ]);
      if (upErr) throw upErr;

      setStoragePath(path);
      setSource(file.type === "application/pdf" ? "pdf" : "photo");
      setDraft(result);
      toast.success("Nota lida! Confira e salve.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no OCR");
    } finally { setScanning(false); }
  };

  const startManual = () => {
    setSource("manual");
    setStoragePath(null);
    setDraft({
      merchant_name: "",
      merchant_document: null,
      category: null,
      expense_date: todayISO(),
      expense_time: null,
      total_amount: 0,
      payment_method: "outros",
      items: [],
    });
  };

  const detectRecurring = (d: OcrResult): string | null => {
    const text = `${d.merchant_name} ${d.category ?? ""}`.toLowerCase();
    const hit = RECUR_CATEGORIES.find((c) => text.includes(c));
    return hit ?? null;
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.merchant_name.trim()) { toast.error("Informe o estabelecimento."); return; }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");

      const { data: exp, error: e1 } = await supabase
        .from("expenses")
        .insert({
          user_id: userId,
          merchant_name: draft.merchant_name.trim(),
          merchant_document: draft.merchant_document ?? null,
          category: draft.category ?? null,
          expense_date: draft.expense_date ?? todayISO(),
          expense_time: draft.expense_time ?? null,
          total_amount: draft.total_amount,
          payment_method: draft.payment_method,
          source,
          storage_path: storagePath,
        })
        .select("id")
        .single();
      if (e1) throw e1;

      if (draft.items.length > 0) {
        const itemsPayload = draft.items.map((it) => ({
          expense_id: exp.id,
          user_id: userId,
          raw_name: it.raw_name,
          normalized_name: it.normalized_name ?? null,
          category: it.category ?? null,
          quantity: it.quantity ?? 1,
          unit: it.unit ?? null,
          unit_price: it.unit_price ?? 0,
          total_price: it.total_price ?? 0,
        }));
        const { data: insertedItems, error: e2 } = await supabase
          .from("expense_items")
          .insert(itemsPayload)
          .select("id,normalized_name,unit_price,quantity,unit");
        if (e2) throw e2;

        // Persiste histórico de preços e cache de normalização
        const prices = (insertedItems ?? [])
          .filter((it) => it.normalized_name && Number(it.unit_price) > 0)
          .map((it) => ({
            user_id: userId,
            normalized_name: it.normalized_name as string,
            merchant_name: draft.merchant_name.trim(),
            unit_price: Number(it.unit_price),
            quantity: Number(it.quantity),
            unit: it.unit,
            purchase_date: draft.expense_date ?? todayISO(),
            expense_item_id: it.id,
          }));
        if (prices.length) {
          await supabase.from("product_prices").insert(prices);
        }

        const norms = draft.items
          .filter((it) => it.normalized_name && it.raw_name)
          .map((it) => ({
            raw_name: it.raw_name.toUpperCase().trim(),
            normalized_name: it.normalized_name as string,
            confidence: 0.85,
          }));
        if (norms.length) {
          await supabase.from("product_normalization").upsert(norms, { onConflict: "raw_name" });
        }
      }

      // Sugerir cadastro como recorrente
      const recur = detectRecurring(draft);
      if (recur) {
        toast.message("Conta recorrente detectada", {
          description: `Cadastrar "${draft.merchant_name}" como ${recur} recorrente?`,
          action: { label: "Cadastrar", onClick: () => navigate({ to: "/recorrentes" }) },
        });
      }

      toast.success("Despesa salva!");
      navigate({ to: "/despesas" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="Nova despesa" title="Adicionar nota" />

      {!draft && (
        <div className="space-y-3">
          <label className="block bg-card border border-border rounded-3xl p-6 cursor-pointer hover:bg-muted transition-colors">
            <div className="flex items-center gap-4">
              <div className="size-12 shrink-0 rounded-2xl bg-primary-soft grid place-items-center text-primary">
                <ScanLine className="size-6" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold">Escanear nota (foto ou PDF)</p>
                <p className="text-xs text-muted-foreground">
                  Extração automática com IA: estabelecimento, itens, valores.
                </p>
              </div>
            </div>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {scanning && (
              <div className="mt-4 flex items-center gap-2 text-sm text-primary">
                <Loader2 className="size-4 animate-spin" /> Lendo nota fiscal…
              </div>
            )}
          </label>

          <button
            onClick={startManual}
            className="block w-full bg-card border border-border rounded-3xl p-6 text-left hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="size-12 shrink-0 rounded-2xl bg-muted grid place-items-center text-muted-foreground">
                <Upload className="size-6" />
              </div>
              <div>
                <p className="font-semibold">Inclusão manual</p>
                <p className="text-xs text-muted-foreground">Preencha os campos sem foto.</p>
              </div>
            </div>
          </button>
        </div>
      )}

      {draft && (
        <div className="space-y-4">
          <div className="bg-primary-soft border border-primary/20 rounded-2xl p-3 text-[12px] text-primary font-medium">
            {source !== "manual"
              ? "Prévia extraída pela IA. Revise antes de salvar."
              : "Preencha os campos da despesa."}
          </div>

          <Field label="Estabelecimento">
            <Input
              value={draft.merchant_name}
              onChange={(e) => setDraft({ ...draft, merchant_name: e.target.value })}
              className="rounded-xl"
            />
          </Field>
          <Field label="CNPJ">
            <Input
              value={draft.merchant_document ?? ""}
              onChange={(e) => setDraft({ ...draft, merchant_document: e.target.value || null })}
              className="rounded-xl"
              placeholder="00.000.000/0000-00"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Input
                value={draft.category ?? ""}
                onChange={(e) => setDraft({ ...draft, category: e.target.value || null })}
                className="rounded-xl"
                placeholder="Supermercado"
              />
            </Field>
            <Field label="Valor total">
              <Input
                type="number"
                step="0.01"
                value={draft.total_amount}
                onChange={(e) => setDraft({ ...draft, total_amount: Number(e.target.value) })}
                className="rounded-xl"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <Input
                type="date"
                value={draft.expense_date ?? todayISO()}
                onChange={(e) => setDraft({ ...draft, expense_date: e.target.value })}
                className="rounded-xl"
              />
            </Field>
            <Field label="Hora">
              <Input
                type="time"
                value={draft.expense_time?.slice(0,5) ?? ""}
                onChange={(e) => setDraft({ ...draft, expense_time: e.target.value || null })}
                className="rounded-xl"
              />
            </Field>
          </div>
          <Field label="Pagamento">
            <Select
              value={draft.payment_method}
              onValueChange={(v) => setDraft({ ...draft, payment_method: v as OcrResult["payment_method"] })}
            >
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENTS.map((p) => (
                  <SelectItem key={p} value={p}>{PAYMENT_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {draft.items.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Itens ({draft.items.length})
              </p>
              <div className="space-y-2">
                {draft.items.map((it, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 bg-card border border-border rounded-xl p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{it.raw_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {it.normalized_name ?? "—"} • {it.quantity ?? 1} {it.unit ?? ""}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">{brl(Number(it.total_price ?? 0))}</p>
                    <button
                      onClick={() => setDraft({ ...draft, items: draft.items.filter((_, j) => j !== i) })}
                      className="text-muted-foreground hover:text-destructive p-1"
                      aria-label="Remover"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => { setDraft(null); setStoragePath(null); }} className="flex-1 h-12 rounded-2xl">
              Cancelar
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-semibold"
            >
              {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
              Salvar despesa
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
