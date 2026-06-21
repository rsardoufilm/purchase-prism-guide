import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
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
import { Loader2, ScanLine, Upload, Trash2, Check, Circle, Camera, FileText, Plus, AlertTriangle, Eraser } from "lucide-react";
import { ocrReceipt, type OcrResult } from "@/lib/ocr.functions";
import { brl } from "@/lib/format";
import { classifyItem, normalizeName, classifyMerchant } from "@/lib/classifier";
import { requestCameraPermission } from "@/lib/camera-permission";
import { logFailure, readFailures, clearFailures, type FailureEntry } from "@/lib/failure-log";
import { useEffect } from "react";


export const Route = createFileRoute("/_authenticated/despesas/nova")({
  component: NovaDespesa,
  head: () => ({ meta: [{ title: "Nova despesa — AURA Finance" }] }),
});

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED = new Set(["image/jpeg", "image/jpg", "image/png", "application/pdf"]);

const PAYMENTS = ["pix","credito","debito","dinheiro","vale_alimentacao","vale_refeicao","outros"] as const;
const PAYMENT_LABELS: Record<string,string> = {
  pix:"PIX", credito:"Crédito", debito:"Débito", dinheiro:"Dinheiro",
  vale_alimentacao:"Vale Alimentação", vale_refeicao:"Vale Refeição", outros:"Outros",
};
const RECUR_CATEGORIES = ["energia","água","internet","telefonia","streaming","luz"];

const CATEGORY_OPTIONS = [
  "Arroz","Feijão","Carne Bovina","Frango","Suínos","Peixes","Frios","Queijos",
  "Leite","Iogurtes","Pães","Massas","Óleos","Açúcar","Café","Bebidas",
  "Refrigerantes","Cervejas","Águas","Frutas","Verduras","Legumes",
  "Higiene","Limpeza","Pet","Snacks","Doces","Congelados","Outros",
];

type Source = "manual" | "photo" | "pdf";
type StepState = "pending" | "running" | "done" | "error";
type Step = { key: string; label: string; state: StepState };

const STEP_TEMPLATE: Step[] = [
  { key: "receive",  label: "Arquivo recebido",        state: "pending" },
  { key: "upload",   label: "Upload concluído",        state: "pending" },
  { key: "ocr",      label: "OCR concluído",           state: "pending" },
  { key: "items",    label: "Itens encontrados",       state: "pending" },
  { key: "classify", label: "Classificação executada", state: "pending" },
];

function todayISO() { return new Date().toISOString().slice(0, 10); }

function NovaDespesa() {
  const navigate = useNavigate();
  const runOcr = useServerFn(ocrReceipt);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source>("manual");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<OcrResult | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>(STEP_TEMPLATE);
  const [itemsCount, setItemsCount] = useState<number>(0);
  const [failures, setFailures] = useState<FailureEntry[]>(() => readFailures());

  useEffect(() => {
    const refresh = () => setFailures(readFailures());
    window.addEventListener("aura:failures-changed", refresh);
    return () => window.removeEventListener("aura:failures-changed", refresh);
  }, []);


  const setStep = (key: string, state: StepState) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, state } : s)));

  const openCamera = async () => {
    console.log("[CAMERA_OPEN] solicitando permissão");
    const res = await requestCameraPermission();
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    console.log("[CAMERA_OPEN] permissão concedida, abrindo input");
    cameraRef.current?.click();
  };


  const handleFile = async (file: File) => {
    if (!ACCEPTED.has(file.type)) {
      const msg = `Formato inválido (${file.type || "desconhecido"}). Use JPG, PNG ou PDF.`;
      logFailure("validate_type", msg, { name: file.name, type: file.type, size: file.size });
      toast.error(msg); return;
    }
    if (file.size > MAX_BYTES) {
      const msg = "Arquivo muito grande (máximo 10MB).";
      logFailure("validate_size", msg, { name: file.name, size: file.size });
      toast.error(msg); return;
    }

    setScanning(true);
    setSteps(STEP_TEMPLATE.map((s) => ({ ...s })));
    setStep("receive", "done");

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

      setStep("upload", "running");
      setStep("ocr", "running");
      const [{ error: upErr }, result] = await Promise.all([
        supabase.storage.from("receipts").upload(path, file, { contentType: file.type, upsert: false }),
        runOcr({ data: { fileDataUrl: dataUrl, mimeType: file.type } }),
      ]);
      if (upErr) { setStep("upload", "error"); throw upErr; }
      setStep("upload", "done");
      setStep("ocr", "done");

      // Classificação determinística pós-OCR
      const enriched: OcrResult = {
        ...result,
        category: result.category ?? classifyMerchant(result.merchant_name) ?? null,
        items: result.items.map((it) => {
          const cat = it.category ?? classifyItem(it.raw_name);
          const norm = it.normalized_name ?? normalizeName(it.raw_name);
          return { ...it, category: cat, normalized_name: norm };
        }),
      };

      setItemsCount(enriched.items.length);
      setStep("items", "done");
      setStep("classify", "done");

      setStoragePath(path);
      setSource(file.type === "application/pdf" ? "pdf" : "photo");
      setDraft(enriched);
      toast.success(`Nota lida! ${enriched.items.length} ${enriched.items.length === 1 ? "item" : "itens"} encontrados.`);
    } catch (e) {
      setSteps((prev) => prev.map((s) => (s.state === "running" ? { ...s, state: "error" } : s)));
      const msg = e instanceof Error ? e.message : "Falha no OCR";
      logFailure("ocr_pipeline", msg, { name: file.name, type: file.type, size: file.size });
      toast.error(msg);
    } finally { setScanning(false); }
  };


  const startManual = () => {
    setSource("manual");
    setStoragePath(null);
    setSteps(STEP_TEMPLATE);
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
    return RECUR_CATEGORIES.find((c) => text.includes(c)) ?? null;
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
        if (prices.length) await supabase.from("product_prices").insert(prices);

        // product_normalization é uma tabela de lookup compartilhada
        // gerenciada server-side; clientes não escrevem nela.

      }

      // Notifica dashboards para atualizar
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("aura:data-changed"));
      }

      const recur = detectRecurring(draft);
      if (recur) {
        toast.message("Conta recorrente detectada", {
          description: `Cadastrar "${draft.merchant_name}" como ${recur}?`,
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
          <p className="text-xs text-muted-foreground px-1">
            Escolha como adicionar sua despesa:
          </p>

          {/* 1. OCR — foto pela câmera */}
          <button
            type="button"
            onClick={openCamera}

            className="w-full bg-card border border-border rounded-3xl p-5 text-left hover:bg-muted transition-colors flex items-center gap-4"
          >
            <div className="size-12 shrink-0 rounded-2xl bg-primary-soft grid place-items-center text-primary">
              <ScanLine className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Escanear com a câmera</p>
              <p className="text-xs text-muted-foreground">
                OCR automático da nota fiscal — tire uma foto.
              </p>
            </div>
            <Camera className="size-5 text-muted-foreground shrink-0" />
          </button>

          {/* 2. Upload de arquivo */}
          <button
            type="button"
            onClick={() => {
              console.log("[FILE_PICKER_OPEN] abrindo seletor de arquivo");
              fileRef.current?.click();
            }}
            className="w-full bg-card border border-border rounded-3xl p-5 text-left hover:bg-muted transition-colors flex items-center gap-4"
          >
            <div className="size-12 shrink-0 rounded-2xl bg-primary-soft grid place-items-center text-primary">
              <FileText className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Enviar arquivo</p>
              <p className="text-xs text-muted-foreground">
                Imagem (JPG/PNG) ou PDF da galeria — até 10MB.
              </p>
            </div>
            <Upload className="size-5 text-muted-foreground shrink-0" />
          </button>

          {/* 3. Manual */}
          <button
            type="button"
            onClick={startManual}
            className="w-full bg-card border border-border rounded-3xl p-5 text-left hover:bg-muted transition-colors flex items-center gap-4"
          >
            <div className="size-12 shrink-0 rounded-2xl bg-muted grid place-items-center text-muted-foreground">
              <Plus className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Inclusão manual</p>
              <p className="text-xs text-muted-foreground">
                Preencher os campos sem foto nem OCR.
              </p>
            </div>
          </button>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              console.log("[CAMERA_OPEN] arquivo selecionado:", f?.name, f?.type, f?.size);
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,application/pdf"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              console.log("[FILE_PICKER_OPEN] arquivo selecionado:", f?.name, f?.type, f?.size);
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />

          {scanning && (
            <div className="flex items-center gap-2 text-sm text-primary px-1">
              <Loader2 className="size-4 animate-spin" /> Processando nota fiscal…
            </div>
          )}

          {steps.some((s) => s.state !== "pending") && (
            <AuditLog steps={steps} itemsCount={itemsCount} />
          )}
        </div>
      )}

      {draft && (
        <div className="space-y-4">
          <AuditLog steps={steps} itemsCount={itemsCount} compact />

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
                    className="bg-card border border-border rounded-xl p-3 space-y-2"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
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
                    <Select
                      value={it.category ?? "Outros"}
                      onValueChange={(v) => {
                        const next = [...draft.items];
                        next[i] = { ...next[i], category: v };
                        setDraft({ ...draft, items: next });
                      }}
                    >
                      <SelectTrigger className="rounded-lg h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => { setDraft(null); setStoragePath(null); setSteps(STEP_TEMPLATE); }} className="flex-1 h-12 rounded-2xl">
              Cancelar
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-semibold"
            >
              {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
              Confirmar importação
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function AuditLog({ steps, itemsCount, compact }: { steps: Step[]; itemsCount: number; compact?: boolean }) {
  return (
    <div className={`bg-card border border-border rounded-2xl ${compact ? "p-3" : "p-4"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Auditoria do processamento
      </p>
      <ol className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-xs">
            {s.state === "done" && <Check className="size-3.5 text-primary shrink-0" />}
            {s.state === "running" && <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />}
            {s.state === "error" && <Circle className="size-3.5 text-destructive fill-destructive shrink-0" />}
            {s.state === "pending" && <Circle className="size-3.5 text-muted-foreground/40 shrink-0" />}
            <span className={s.state === "done" ? "text-foreground" : "text-muted-foreground"}>
              {s.label}
              {s.key === "items" && s.state === "done" && itemsCount > 0 && ` (${itemsCount})`}
            </span>
          </li>
        ))}
      </ol>
    </div>
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
