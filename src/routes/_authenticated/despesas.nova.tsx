import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { prepareFileForUpload } from "@/utils/fileCompressor";
import { PageHeader } from "@/components/page-header";
import { TourGuide } from "@/components/tour-guide";
import { TOURS } from "@/lib/tours";
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
import {
  Loader2,
  ScanLine,
  Upload,
  Trash2,
  Check,
  Circle,
  Camera,
  FileText,
  Plus,
  AlertTriangle,
  Info,
  Eraser,
} from "lucide-react";
import { ocrReceipt, type OcrResult } from "@/lib/ocr.functions";
import { brl } from "@/lib/format";
import {
  classifyItem,
  normalizeName,
  classifyMerchant,
  inferExpenseCategory,
  MERCHANT_CATEGORY_OPTIONS,
} from "@/lib/classifier";
import {
  loadLearnedDictionary,
  suggestFromDictionary,
  recordItemCorrection,
  type LearnedDictionary,
} from "@/lib/learned-dictionary";
import {
  loadUserExpenseCategoryMap,
  suggestExpenseCategory,
  type UserExpenseCategoryMap,
} from "@/lib/user-classifier-expense";
import { CameraCapture } from "@/components/camera-capture";
import { logFailure, readFailures, clearFailures, type FailureEntry } from "@/lib/failure-log";
import { useEffect } from "react";
import { Sparkles, UserCheck } from "lucide-react";
import { detectPriceAnomalies, type PriceAnomaly } from "@/lib/price-anomaly";
import { PriceAnomalyDialog } from "@/components/price-anomaly-dialog";
import {
  detectAliasCandidates,
  saveAlias,
  type AliasCandidate,
} from "@/lib/product-aliases";
import { ProductAliasDialog } from "@/components/product-alias-dialog";

type CategorySource =
  | "ocr"
  | "pessoal"
  | "global"
  | "learned"
  | "rule"
  | "user"
  | null;

export const Route = createFileRoute("/_authenticated/despesas/nova")({
  component: NovaDespesa,
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  head: () => ({ meta: [{ title: "Nova despesa — AURA Consumo" }] }),
});

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED = new Set(["image/jpeg", "image/jpg", "image/png", "application/pdf"]);

const PAYMENTS = [
  "pix",
  "credito",
  "debito",
  "dinheiro",
  "vale_alimentacao",
  "vale_refeicao",
  "outros",
] as const;
const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  credito: "Crédito",
  debito: "Débito",
  dinheiro: "Dinheiro",
  vale_alimentacao: "Vale Alimentação",
  vale_refeicao: "Vale Refeição",
  outros: "Outros",
};
const RECUR_CATEGORIES = ["energia", "água", "internet", "telefonia", "streaming", "luz"];

const CATEGORY_OPTIONS = [
  "Arroz",
  "Feijão",
  "Carne Bovina",
  "Frango",
  "Suínos",
  "Peixes",
  "Frios",
  "Queijos",
  "Laticínios",
  "Leite",
  "Iogurtes",
  "Pães",
  "Massas",
  "Óleos",
  "Açúcar",
  "Café",
  "Bebidas",
  "Refrigerantes",
  "Cervejas",
  "Águas",
  "Frutas",
  "Verduras",
  "Legumes",
  "Higiene",
  "Limpeza",
  "Pet",
  "Snacks",
  "Doces",
  "Congelados",
  "Outros",
];

type Source = "manual" | "photo" | "pdf";
type StepState = "pending" | "running" | "done" | "error";
type Step = { key: string; label: string; state: StepState };

const STEP_TEMPLATE: Step[] = [
  { key: "receive", label: "Arquivo recebido", state: "pending" },
  { key: "upload", label: "Upload concluído", state: "pending" },
  { key: "ocr", label: "OCR concluído", state: "pending" },
  { key: "items", label: "Itens encontrados", state: "pending" },
  { key: "classify", label: "Classificação executada", state: "pending" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function NovaDespesa() {
  const navigate = useNavigate();
  const { id: editId } = Route.useSearch();
  const runOcr = useServerFn(ocrReceipt);
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source>("manual");
  const [scanning, setScanning] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<OcrResult | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>(STEP_TEMPLATE);
  const [itemsCount, setItemsCount] = useState<number>(0);
  const [failures, setFailures] = useState<FailureEntry[]>(() => readFailures());
  const [loadingEdit, setLoadingEdit] = useState<boolean>(!!editId);
  const [userCatMap, setUserCatMap] = useState<LearnedDictionary>({
    personal: new Map(),
    global: new Map(),
  });
  const [userExpMap, setUserExpMap] = useState<UserExpenseCategoryMap>({
    byMerchant: new Map(),
  });
  // Origem da categoria por item (paralelo a draft.items por posição).
  const [itemSources, setItemSources] = useState<CategorySource[]>([]);
  const [expenseCategorySource, setExpenseCategorySource] = useState<CategorySource>(null);
  // Índices de itens cujo preço fora-do-padrão já foi confirmado manualmente
  // pelo usuário no diálogo de anomalia — não voltam a alertar nesta sessão.
  const [priceConfirmedIdx, setPriceConfirmedIdx] = useState<Set<number>>(new Set());
  const [anomalyQueue, setAnomalyQueue] = useState<PriceAnomaly[]>([]);
  const [currentAnomaly, setCurrentAnomaly] = useState<PriceAnomaly | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadLearnedDictionary(), loadUserExpenseCategoryMap()]).then(([m, em]) => {
      if (cancelled) return;
      setUserCatMap(m);
      setUserExpMap(em);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const refresh = () => setFailures(readFailures());
    window.addEventListener("aura:failures-changed", refresh);
    return () => window.removeEventListener("aura:failures-changed", refresh);
  }, []);

  // Modo edição: carrega despesa + itens
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ data: exp, error: e1 }, { data: items, error: e2 }] = await Promise.all([
          supabase
            .from("expenses")
            .select(
              "merchant_name,merchant_document,category,expense_date,expense_time,total_amount,payment_method,source,storage_path",
            )
            .eq("id", editId)
            .maybeSingle(),
          supabase
            .from("expense_items")
            .select("raw_name,normalized_name,category,quantity,unit,unit_price,total_price")
            .eq("expense_id", editId),
        ]);
        if (cancelled) return;
        if (e1 || !exp) throw e1 ?? new Error("Despesa não encontrada");
        if (e2) throw e2;
        setSource((exp.source as Source) ?? "manual");
        setStoragePath(exp.storage_path ?? null);
        setDraft({
          merchant_name: exp.merchant_name ?? "",
          merchant_document: exp.merchant_document ?? null,
          category: exp.category ?? null,
          expense_date: exp.expense_date ?? todayISO(),
          expense_time: exp.expense_time ?? null,
          total_amount: Number(exp.total_amount ?? 0),
          payment_method: exp.payment_method as OcrResult["payment_method"],
          items: (items ?? []).map((it) => ({
            raw_name: it.raw_name,
            normalized_name: it.normalized_name,
            category: it.category,
            quantity: Number(it.quantity ?? 1),
            unit: it.unit,
            unit_price: Number(it.unit_price ?? 0),
            total_price: Number(it.total_price ?? 0),
          })),
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao carregar despesa");
        navigate({ to: "/despesas" });
      } finally {
        if (!cancelled) setLoadingEdit(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, navigate]);

  const setStep = (key: string, state: StepState) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, state } : s)));

  const openCamera = () => {
    console.log("[CAMERA_OPEN] abrindo captura nativa (getUserMedia, traseira)");
    setCameraOpen(true);
  };

  const handleFile = async (file: File, origin: "camera" | "upload" = "upload") => {
    if (!ACCEPTED.has(file.type)) {
      const msg = `Formato inválido (${file.type || "desconhecido"}). Use JPG, PNG ou PDF.`;
      logFailure("validate_type", msg, { name: file.name, type: file.type, size: file.size });
      toast.error(msg);
      return;
    }
    if (file.size > MAX_BYTES) {
      const msg = "Arquivo muito grande (máximo 10MB).";
      logFailure("validate_size", msg, { name: file.name, size: file.size });
      toast.error(msg);
      return;
    }

    setScanning(true);
    setSteps(STEP_TEMPLATE.map((s) => ({ ...s })));
    setStep("receive", "done");

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");

      const now = new Date();

      const { file: readyFile, wasCompressed, originalSizeKB, finalSizeKB } =
        await prepareFileForUpload(file, 100);
      if (wasCompressed) {
        console.log(`Arquivo comprimido: ${originalSizeKB}KB → ${finalSizeKB}KB`);
      }

      const ext =
        readyFile.name.split(".").pop() ||
        (readyFile.type === "application/pdf" ? "pdf" : "jpg");
      const path = `${userId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ext}`;

      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = () => rej(fr.error);
        fr.readAsDataURL(readyFile);
      });

      setStep("upload", "running");
      setStep("ocr", "running");
      const [{ error: upErr }, result] = await Promise.all([
        supabase.storage
          .from("receipts")
          .upload(path, readyFile, { contentType: readyFile.type, upsert: false }),
        runOcr({ data: { fileDataUrl: dataUrl, mimeType: readyFile.type, source: origin } }),
      ]);
      if (upErr) {
        setStep("upload", "error");
        throw upErr;
      }
      setStep("upload", "done");
      setStep("ocr", "done");

      // Classificação determinística pós-OCR
      // Prioridade: categoria já vinda do OCR → histórico do usuário → regras → null
      const sources: CategorySource[] = [];
      const processedItems = result.items.map((it) => {
        let source: CategorySource = null;
        let cat = it.category ?? null;
        if (cat) source = "ocr";
        if (!cat) {
          const hit = suggestFromDictionary(it.raw_name, userCatMap);
          if (hit) {
            cat = hit.category;
            source = hit.source; // "pessoal" | "global"
          }
        }
        if (!cat) {
          const rule = classifyItem(it.raw_name);
          if (rule) {
            cat = rule;
            source = "rule";
          }
        }
        sources.push(source);
        const norm = it.normalized_name ?? normalizeName(it.raw_name);
        return { ...it, category: cat, normalized_name: norm };
      });
      const inferredCategory = inferExpenseCategory(processedItems, result.merchant_name);
      const learnedExp = suggestExpenseCategory(result.merchant_name, userExpMap);
      let expCat: string | null = result.category ?? null;
      let expSource: CategorySource = expCat ? "ocr" : null;
      if (!expCat && learnedExp) {
        expCat = learnedExp;
        expSource = "learned";
      }
      if (!expCat && inferredCategory) {
        expCat = inferredCategory;
        expSource = "rule";
      }
      const enriched: OcrResult = {
        ...result,
        category: expCat,
        items: processedItems,
      };

      setItemsCount(enriched.items.length);
      setStep("items", "done");
      setStep("classify", "done");

      setStoragePath(path);
      setSource(file.type === "application/pdf" ? "pdf" : "photo");
      setDraft(enriched);
      setItemSources(sources);
      setPriceConfirmedIdx(new Set());
      setExpenseCategorySource(expSource);
      toast.success(
        `Nota lida! ${enriched.items.length} ${enriched.items.length === 1 ? "item" : "itens"} encontrados.`,
      );
    } catch (e) {
      setSteps((prev) => prev.map((s) => (s.state === "running" ? { ...s, state: "error" } : s)));
      const msg = e instanceof Error ? e.message : "Falha no OCR";
      logFailure("ocr_pipeline", msg, { name: file.name, type: file.type, size: file.size });
      toast.error(msg);
    } finally {
      setScanning(false);
    }
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

  const advanceAnomalyQueue = (confirmed: Set<number>) => {
    const remaining = anomalyQueue.filter((a) => !confirmed.has(a.index));
    if (remaining.length === 0) {
      setCurrentAnomaly(null);
      setAnomalyQueue([]);
      void save(confirmed);
    } else {
      setCurrentAnomaly(remaining[0]);
      setAnomalyQueue(remaining.slice(1));
    }
  };

  const save = async (confirmedOverride?: Set<number>) => {
    if (!draft) return;
    if (!draft.merchant_name.trim()) {
      toast.error("Informe o estabelecimento.");
      return;
    }
    if (!draft.category) {
      const ok = window.confirm(
        "Esta despesa está sem categoria. Deseja salvar mesmo assim? (Você pode classificar depois pela lista de despesas)",
      );
      if (!ok) {
        toast.message("Selecione uma categoria antes de salvar.");
        return;
      }
    }

    // Validação de anomalias de preço: bloqueia salvamento se algum item
    // tiver preço > 200% acima da média histórica e ainda não foi confirmado.
    const confirmed = confirmedOverride ?? priceConfirmedIdx;
    const anomalies = await detectPriceAnomalies(
      draft.items.map((it, i) => ({
        raw_name: it.raw_name,
        normalized_name: it.normalized_name ?? null,
        unit_price: it.unit_price ?? 0,
        preco_confirmado_manualmente: confirmed.has(i),
      })),
    );
    if (anomalies.length > 0) {
      setCurrentAnomaly(anomalies[0]);
      setAnomalyQueue(anomalies.slice(1));
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");

      let expenseId: string;
      if (editId) {
        const { error: eu } = await supabase
          .from("expenses")
          .update({
            merchant_name: draft.merchant_name.trim(),
            merchant_document: draft.merchant_document ?? null,
            category: draft.category ?? null,
            expense_date: draft.expense_date ?? todayISO(),
            expense_time: draft.expense_time ?? null,
            total_amount: draft.total_amount,
            payment_method: draft.payment_method,
          })
          .eq("id", editId);
        if (eu) throw eu;
        // Itens: substitui todos (mais simples e consistente para edição)
        const { error: edi } = await supabase
          .from("expense_items")
          .delete()
          .eq("expense_id", editId);
        if (edi) throw edi;
        expenseId = editId;
      } else {
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
        expenseId = exp.id;
      }

      if (draft.items.length > 0) {
        const itemsPayload = draft.items.map((it, i) => ({
          expense_id: expenseId,
          user_id: userId,
          raw_name: it.raw_name,
          normalized_name: it.normalized_name ?? null,
          category: it.category ?? null,
          quantity: it.quantity ?? 1,
          unit: it.unit ?? null,
          unit_price: it.unit_price ?? 0,
          total_price: it.total_price ?? 0,
          preco_confirmado_manualmente: confirmed.has(i),
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

      toast.success(editId ? "Despesa atualizada!" : "Despesa salva!");
      navigate({ to: "/despesas" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={editId ? "Editar despesa" : "Nova despesa"}
        title={editId ? "Editar nota" : "Adicionar nota"}
        tourKey={editId ? undefined : "despesas-nova"}
      />
      {!editId && <TourGuide tourKey="despesas-nova" steps={TOURS["despesas-nova"]} />}

      {loadingEdit && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando despesa…
        </div>
      )}

      {!draft && !loadingEdit && !editId && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground px-1">Escolha como adicionar sua despesa:</p>

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
              <p className="text-[10px] text-amber-500 flex items-center gap-1 mt-0.5">
                <AlertTriangle className="size-3" />
                Nota amassada ou ilegível? A leitura pode falhar.
              </p>
              <p className="text-[10px] text-blue-500 flex items-center gap-1">
                <Info className="size-3" />
                Leitura mais precisa pelo "Enviar arquivo".
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
              <p className="text-xs text-muted-foreground">Preencher os campos sem foto nem OCR.</p>
            </div>
          </button>

          <CameraCapture
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onCapture={(file) => {
              console.log("[CAMERA_OPEN] foto capturada:", file.name, file.type, file.size);
              setCameraOpen(false);
              handleFile(file, "camera");
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

          <FailureDiary
            entries={failures}
            onClear={() => {
              clearFailures();
              setFailures([]);
            }}
          />
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
              onBlur={(e) => {
                // Auto-classifica categoria ao sair do campo (apenas se ainda vazia)
                if (!draft.category) {
                  const name = e.target.value;
                  const learned = suggestExpenseCategory(name, userExpMap);
                  if (learned) {
                    setDraft({ ...draft, category: learned });
                    setExpenseCategorySource("learned");
                    return;
                  }
                  const inferred =
                    classifyMerchant(name) ?? inferExpenseCategory(draft.items, name);
                  if (inferred) {
                    setDraft({ ...draft, category: inferred });
                    setExpenseCategorySource("rule");
                  }
                }
              }}
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
            <Field
              label="Categoria"
              hint={<CategorySourceBadge source={expenseCategorySource} />}
            >
              <Select
                value={draft.category ?? ""}
                onValueChange={(v) => {
                  setDraft({ ...draft, category: v || null });
                  setExpenseCategorySource("user");
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecionar…" />
                </SelectTrigger>
                <SelectContent>
                  {MERCHANT_CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                value={draft.expense_time?.slice(0, 5) ?? ""}
                onChange={(e) => setDraft({ ...draft, expense_time: e.target.value || null })}
                className="rounded-xl"
              />
            </Field>
          </div>
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

          {draft.items.length > 0 && (
            <ItemsEditor
              items={draft.items}
              total={Number(draft.total_amount) || 0}
              sources={itemSources}
              onChange={(items, nextSources) => {
                setDraft({ ...draft, items });
                if (nextSources) setItemSources(nextSources);
              }}
              userCatMap={userCatMap}
            />
          )}

          {draft && (
            <button
              type="button"
              onClick={() => {
                setDraft({
                  ...draft,
                  items: [
                    ...draft.items,
                    {
                      raw_name: "Novo item",
                      normalized_name: null,
                      category: "Outros",
                      quantity: 1,
                      unit: "un",
                      unit_price: 0,
                      total_price: 0,
                    },
                  ],
                });
                setItemSources([...itemSources, "user"]);
              }}
              className="w-full text-xs text-primary border border-dashed border-primary/40 rounded-xl py-2 hover:bg-primary-soft"
            >
              + Adicionar item manualmente
            </button>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setDraft(null);
                setStoragePath(null);
                setSteps(STEP_TEMPLATE);
                setPriceConfirmedIdx(new Set());
              }}
              className="flex-1 h-12 rounded-2xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void save()}
              disabled={saving}
              className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-semibold"
            >
              {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
              {editId ? "Salvar alterações" : "Confirmar importação"}
            </Button>
          </div>
        </div>
      )}

      <PriceAnomalyDialog
        open={!!currentAnomaly}
        anomaly={currentAnomaly}
        onConfirm={() => {
          if (!currentAnomaly) return;
          const next = new Set(priceConfirmedIdx);
          next.add(currentAnomaly.index);
          setPriceConfirmedIdx(next);
          advanceAnomalyQueue(next);
        }}
        onCorrect={(newPrice) => {
          if (!currentAnomaly || !draft) return;
          const items = [...draft.items];
          const it = { ...items[currentAnomaly.index] };
          it.unit_price = newPrice;
          it.total_price = Math.round(Number(it.quantity ?? 1) * newPrice * 100) / 100;
          items[currentAnomaly.index] = it;
          setDraft({ ...draft, items });
          const next = new Set(priceConfirmedIdx);
          next.add(currentAnomaly.index);
          setPriceConfirmedIdx(next);
          advanceAnomalyQueue(next);
        }}
        onCancel={() => {
          setCurrentAnomaly(null);
          setAnomalyQueue([]);
        }}
      />
    </>
  );
}

function AuditLog({
  steps,
  itemsCount,
  compact,
}: {
  steps: Step[];
  itemsCount: number;
  compact?: boolean;
}) {
  return (
    <div className={`bg-card border border-border rounded-2xl ${compact ? "p-3" : "p-4"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Auditoria do processamento
      </p>
      <ol className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-xs">
            {s.state === "done" && <Check className="size-3.5 text-primary shrink-0" />}
            {s.state === "running" && (
              <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
            )}
            {s.state === "error" && (
              <Circle className="size-3.5 text-destructive fill-destructive shrink-0" />
            )}
            {s.state === "pending" && (
              <Circle className="size-3.5 text-muted-foreground/40 shrink-0" />
            )}
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </Label>
        {hint}
      </div>
      {children}
    </div>
  );
}

function CategorySourceBadge({ source }: { source: CategorySource }) {
  // Por especificação:
  //  - "pessoal" → mostra tag discreta de feedback de aprendizado pessoal.
  //  - "global"  → silencioso (parece que o app "já sabia").
  //  - "ocr"     → silencioso (veio da própria nota).
  if (!source || source === "ocr" || source === "global") return null;
  if (source === "pessoal") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-1.5 py-0.5 text-[9px] font-semibold text-primary"
        title="Aplicado automaticamente a partir das suas correções anteriores"
      >
        <Sparkles className="size-2.5" />
        Classificado com base no seu histórico ✓
      </span>
    );
  }
  if (source === "learned") {
    // Aprendizado de categoria por estabelecimento (merchant), camada separada.
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-1.5 py-0.5 text-[9px] font-semibold text-primary"
        title="Categoria sugerida pelo seu histórico de compras neste estabelecimento"
      >
        <Sparkles className="size-2.5" />
        Aprendido
      </span>
    );
  }
  if (source === "rule") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground"
        title="Categoria sugerida por regra automática"
      >
        Auto
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold text-secondary-foreground"
      title="Categoria definida por você"
    >
      <UserCheck className="size-2.5" />
      Você
    </span>
  );
}

type EditableItem = OcrResult["items"][number];

function ItemsEditor({
  items,
  total,
  onChange,
  userCatMap,
  sources,
}: {
  items: EditableItem[];
  total: number;
  onChange: (items: EditableItem[], sources?: CategorySource[]) => void;
  userCatMap: LearnedDictionary;
  sources: CategorySource[];
}) {
  const sum = items.reduce((acc, it) => acc + (Number(it.total_price) || 0), 0);
  const diff = Math.abs(sum - total);
  const tolerance = Math.max(0.05, total * 0.02);
  const mismatch = total > 0 && diff > tolerance;

  const update = (i: number, patch: Partial<EditableItem>, opts?: { userEdit?: boolean }) => {
    const next = [...items];
    const merged = { ...next[i], ...patch };
    if (patch.quantity !== undefined || patch.unit_price !== undefined) {
      const q = Number(merged.quantity ?? 1);
      const u = Number(merged.unit_price ?? 0);
      merged.total_price = Math.round(q * u * 100) / 100;
    }
    const nextSources = [...sources];
    if (patch.raw_name !== undefined) {
      const raw = String(patch.raw_name ?? "").trim();
      merged.normalized_name = raw || null;
      if (!merged.category) {
        const hit = suggestFromDictionary(raw, userCatMap);
        if (hit) {
          merged.category = hit.category;
          nextSources[i] = hit.source;
        } else {
          merged.category = classifyItem(raw) ?? "Outros";
          nextSources[i] = "rule";
        }
      }
    }
    if (opts?.userEdit) {
      nextSources[i] = "user";
      // Captura: registra a correção no dicionário pessoal (UPSERT + confirmacoes++).
      // Só faz sentido quando há nome do produto e categoria definidos.
      if (patch.category !== undefined) {
        const raw = String(merged.raw_name ?? "").trim();
        const cat = String(patch.category ?? "").trim();
        if (raw && cat) {
          void recordItemCorrection(raw, cat);
        }
      }
    }
    next[i] = merged;
    onChange(next, nextSources);
  };


  const remove = (i: number) => {
    onChange(
      items.filter((_, j) => j !== i),
      sources.filter((_, j) => j !== i),
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Itens ({items.length})
        </p>
        <p className="text-[10px] text-muted-foreground">
          Soma: <span className="font-semibold text-foreground">{brl(sum)}</span>
        </p>
      </div>

      {mismatch && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-2.5 text-[11px] flex items-start gap-2">
          <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
          <span>
            A soma dos itens ({brl(sum)}) difere do total ({brl(total)}) em {brl(diff)}. Revise
            quantidades e preços antes de salvar.
          </span>
        </div>
      )}

      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Input
                value={it.raw_name}
                onChange={(e) => update(i, { raw_name: e.target.value })}
                className="rounded-lg h-9 text-sm flex-1"
                placeholder="Descrição do item"
              />
              <button
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-destructive p-2 shrink-0"
                aria-label="Remover item"
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-[1fr_70px_1fr_1fr] gap-1.5">
              <div>
                <Label className="text-[9px] uppercase text-muted-foreground">Qtd</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={it.quantity ?? 1}
                  onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                  className="rounded-lg h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[9px] uppercase text-muted-foreground">Un</Label>
                <Input
                  value={it.unit ?? ""}
                  onChange={(e) => update(i, { unit: e.target.value || null })}
                  className="rounded-lg h-8 text-xs"
                  placeholder="un"
                />
              </div>
              <div>
                <Label className="text-[9px] uppercase text-muted-foreground">Vl. Unit.</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={it.unit_price ?? 0}
                  onChange={(e) => update(i, { unit_price: Number(e.target.value) })}
                  className="rounded-lg h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[9px] uppercase text-muted-foreground">Total</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={it.total_price ?? 0}
                  onChange={(e) => update(i, { total_price: Number(e.target.value) })}
                  className="rounded-lg h-8 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={it.category ?? "Outros"}
                onValueChange={(v) => update(i, { category: v }, { userEdit: true })}
              >
                <SelectTrigger className="rounded-lg h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <CategorySourceBadge source={sources[i] ?? null} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FailureDiary({ entries, onClear }: { entries: FailureEntry[]; onClear: () => void }) {
  if (entries.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Diário de falhas ({entries.length})
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <Eraser className="size-3" /> Limpar
        </button>
      </div>
      <ol className="space-y-1.5 max-h-56 overflow-y-auto">
        {entries.slice(0, 10).map((f) => (
          <li key={f.id} className="text-xs border-l-2 border-destructive/40 pl-2">
            <p className="font-medium text-foreground truncate">{f.message}</p>
            <p className="text-[10px] text-muted-foreground">
              {new Date(f.at).toLocaleString("pt-BR")} • {f.stage}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
