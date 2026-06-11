import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ScanLine, Upload, Trash2 } from "lucide-react";
import { ocrReceipt, type OcrResult } from "@/lib/ocr.functions";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/despesas/nova")({
  component: NovaDespesa,
  head: () => ({ meta: [{ title: "Nova despesa — AURA Finance" }] }),
});

const PAYMENTS = ["pix", "credito", "debito", "dinheiro", "vale_alimentacao", "vale_refeicao", "outros"] as const;
const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  credito: "Crédito",
  debito: "Débito",
  dinheiro: "Dinheiro",
  vale_alimentacao: "Vale Alimentação",
  vale_refeicao: "Vale Refeição",
  outros: "Outros",
};

function NovaDespesa() {
  const navigate = useNavigate();
  const runOcr = useServerFn(ocrReceipt);
  const [mode, setMode] = useState<"manual" | "ocr">("ocr");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<OcrResult | null>(null);

  const handleFile = async (file: File) => {
    if (file.size > 12_000_000) {
      toast.error("Arquivo muito grande (máx. 12MB).");
      return;
    }
    setScanning(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = () => rej(fr.error);
        fr.readAsDataURL(file);
      });
      const result = await runOcr({ data: { fileDataUrl: dataUrl, mimeType: file.type } });
      setDraft(result);
      toast.success("Nota lida! Confira e salve.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no OCR");
    } finally {
      setScanning(false);
    }
  };

  const startManual = () => {
    setMode("manual");
    setDraft({
      merchant: "",
      category: null,
      purchased_at: new Date().toISOString(),
      total: 0,
      payment_method: "outros",
      items: [],
    });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.merchant.trim()) {
      toast.error("Informe o estabelecimento.");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");

      const { data: receipt, error: e1 } = await supabase
        .from("receipts")
        .insert({
          user_id: userId,
          merchant: draft.merchant.trim(),
          category: draft.category,
          purchased_at: draft.purchased_at ?? new Date().toISOString(),
          total: draft.total,
          payment_method: draft.payment_method,
          source: mode === "ocr" ? "ocr_foto" : "manual",
        })
        .select("id")
        .single();
      if (e1) throw e1;

      if (draft.items.length > 0) {
        const items = draft.items.map((it) => ({
          receipt_id: receipt.id,
          user_id: userId,
          description: it.description,
          normalized_product: it.normalized_product ?? null,
          category: it.category ?? null,
          quantity: it.quantity ?? 1,
          unit: it.unit ?? null,
          unit_price: it.unit_price ?? 0,
          total: it.total ?? 0,
        }));
        const { error: e2 } = await supabase.from("receipt_items").insert(items);
        if (e2) throw e2;
      }
      toast.success("Despesa salva!");
      navigate({ to: "/despesas" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
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
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
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
            {mode === "ocr"
              ? "Prévia extraída pela IA. Revise antes de salvar."
              : "Preencha os campos da despesa."}
          </div>

          <Field label="Estabelecimento">
            <Input
              value={draft.merchant}
              onChange={(e) => setDraft({ ...draft, merchant: e.target.value })}
              className="rounded-xl"
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
                value={draft.total}
                onChange={(e) => setDraft({ ...draft, total: Number(e.target.value) })}
                className="rounded-xl"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <Input
                type="datetime-local"
                value={(draft.purchased_at ?? new Date().toISOString()).slice(0, 16)}
                onChange={(e) =>
                  setDraft({ ...draft, purchased_at: new Date(e.target.value).toISOString() })
                }
                className="rounded-xl"
              />
            </Field>
            <Field label="Pagamento">
              <Select
                value={draft.payment_method}
                onValueChange={(v) =>
                  setDraft({ ...draft, payment_method: v as OcrResult["payment_method"] })
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENTS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PAYMENT_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

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
                      <p className="text-sm font-medium truncate">{it.description}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {it.normalized_product ?? "—"} • {it.quantity ?? 1} {it.unit ?? ""}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">{brl(Number(it.total ?? 0))}</p>
                    <button
                      onClick={() =>
                        setDraft({ ...draft, items: draft.items.filter((_, j) => j !== i) })
                      }
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
            <Button
              variant="outline"
              onClick={() => setDraft(null)}
              className="flex-1 h-12 rounded-2xl"
            >
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
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
