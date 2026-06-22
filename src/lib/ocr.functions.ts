import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  fileDataUrl: z.string().min(20).max(15_000_000),
  mimeType: z.string().min(3).max(100),
  // "upload" usa modelo mais preciso (Pro) + passe de reconciliação.
  // "camera" mantém Flash para resposta rápida no fluxo de captura.
  source: z.enum(["upload", "camera"]).optional().default("camera"),
});

const ItemSchema = z.object({
  raw_name: z.string(),
  normalized_name: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  unit_price: z.number().nullable().optional(),
  gross_price: z.number().nullable().optional(),
  discount: z.number().nullable().optional(),
  total_price: z.number().nullable().optional(),
});

const ResultSchema = z.object({
  merchant_name: z.string(),
  merchant_document: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  expense_date: z.string().nullable().optional(), // YYYY-MM-DD
  expense_time: z.string().nullable().optional(), // HH:MM or HH:MM:SS
  subtotal_amount: z.number().nullable().optional(),
  discount_total: z.number().nullable().optional(),
  total_amount: z.number(),
  payment_method: z
    .enum(["pix", "credito", "debito", "dinheiro", "vale_alimentacao", "vale_refeicao", "outros"])
    .default("outros"),
  items: z.array(ItemSchema).default([]),
});

export type OcrResult = z.infer<typeof ResultSchema>;

const CATEGORIES = [
  "Supermercado",
  "Carnes",
  "Padaria",
  "Bebidas",
  "Laticínios",
  "Higiene",
  "Limpeza",
  "Farmácia",
  "Combustível",
  "Restaurantes",
  "Outros",
] as const;

const SYSTEM_PROMPT = `Você é um extrator OCR especialista em notas fiscais brasileiras (NFC-e/NF-e/cupons em papel térmico).
Extraia os dados em JSON ESTRITO com este schema:
{
  "merchant_name": string,
  "merchant_document": string|null,
  "category": string|null,                 // uma de: ${CATEGORIES.join(", ")}
  "expense_date": string|null,             // YYYY-MM-DD
  "expense_time": string|null,             // HH:MM:SS
  "total_amount": number,
  "payment_method": "pix"|"credito"|"debito"|"dinheiro"|"vale_alimentacao"|"vale_refeicao"|"outros",
  "items": [
    {
      "raw_name": string,
      "normalized_name": string|null,
      "category": string|null,
      "quantity": number|null,
      "unit": string|null,                 // "kg","g","l","ml","un","cx","pct","dz"
      "unit_price": number|null,
      "total_price": number|null
    }
  ]
}

Regras CRÍTICAS para ITENS (papel térmico costuma estar borrado — siga à risca):
1. raw_name = texto EXATAMENTE como aparece, PRESERVANDO espaços entre palavras. Se vir "COCACOLA2L" reconstrua para "COCA COLA 2L". NUNCA grude palavras nem invente caracteres.
2. Remova códigos numéricos longos (EAN/SKU com 8+ dígitos seguidos) do raw_name — não fazem parte do nome do produto.
3. Cada linha de item geralmente tem "Qtd X UN Vl.Unit Y Vl.Total Z". Extraia quantity, unit_price e total_price desses números. Valide: quantity * unit_price ≈ total_price (tolerância R$ 0,02). Se não bater, releia a linha antes de responder.
4. normalized_name agrupa equivalentes: "ARROZ TIPO 1 5KG TIO JOÃO" → "Arroz"; "COCA COLA 2L" → "Refrigerante"; "PÃO FRANCÊS UN" → "Pães"; "LEITE INTEGRAL UHT 1L" → "Leite"; "FEIJÃO CARIOCA 1KG" → "Feijão"; "CREME DENTAL COLGATE 90G" → "Creme dental" (NUNCA confunda com "Creme de leite"); "CREME DE LEITE NESTLÉ 200G" → "Creme de leite". Leia o raw_name com atenção: "DENTAL" ≠ "DE LEITE".
5. unit infira pelo sufixo: "5KG"→kg, "500G"→g, "2L"→l, "350ML"→ml; sem sufixo → "un".
6. NUNCA invente itens. Se a linha está ilegível, OMITA — é melhor faltar do que alucinar.
7. RECONCILIAÇÃO: a soma dos total_price dos itens deve ficar a ≤2% do total_amount. Se a diferença for maior, releia antes de responder (provavelmente confundiu quantidade ou preço).

Valores numéricos com ponto decimal (12.90), NUNCA strings. Campos não identificáveis: null. Responda APENAS o objeto JSON, sem markdown.`;

export const ocrReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const isImage = data.mimeType.startsWith("image/");
    const isPdf = data.mimeType === "application/pdf";
    if (!isImage && !isPdf) throw new Error("Apenas imagens ou PDF são aceitos");

    const buildUserContent = (instruction: string): Array<Record<string, unknown>> => {
      const content: Array<Record<string, unknown>> = [{ type: "text", text: instruction }];
      if (isImage) {
        content.push({ type: "image_url", image_url: { url: data.fileDataUrl } });
      } else {
        const base64 = data.fileDataUrl.split(",")[1] ?? data.fileDataUrl;
        content.push({
          type: "file",
          file: { filename: "nota.pdf", file_data: `data:application/pdf;base64,${base64}` },
        });
      }
      return content;
    };

    // Uploads usam modelo mais preciso; câmera mantém Flash para latência.
    const primaryModel =
      data.source === "upload" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";

    const callModel = async (model: string, instruction: string) => {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserContent(instruction) },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        if (res.status === 429) throw new Error("Limite temporário atingido. Tente em instantes.");
        if (res.status === 402) throw new Error("Créditos de IA esgotados.");
        throw new Error(`OCR falhou (${res.status}): ${txt.slice(0, 200)}`);
      }
      const body = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      const raw = body.choices?.[0]?.message?.content ?? "{}";
      try {
        return JSON.parse(raw);
      } catch {
        return JSON.parse(raw.replace(/```json\s*|```/g, "").trim());
      }
    };

    const firstPass = await callModel(
      primaryModel,
      "Extraia esta nota fiscal e responda apenas com o JSON.",
    );
    let parsed = ResultSchema.parse(firstPass);

    // Reconciliação: se a soma dos itens divergir >2% do total, faz um 2º passe pedindo correção.
    if (data.source === "upload" && parsed.items.length > 0 && parsed.total_amount > 0) {
      const itemsSum = parsed.items.reduce((acc, it) => acc + (it.total_price ?? 0), 0);
      const diffPct = Math.abs(itemsSum - parsed.total_amount) / parsed.total_amount;
      if (diffPct > 0.02) {
        try {
          const refined = await callModel(
            primaryModel,
            `Releia a nota com atenção redobrada. Na primeira leitura, a soma dos itens (R$ ${itemsSum.toFixed(2)}) ficou ${(diffPct * 100).toFixed(1)}% diferente do total da nota (R$ ${parsed.total_amount.toFixed(2)}). Reveja quantidades, preços unitários e itens omitidos. Responda apenas o JSON corrigido.`,
          );
          const refinedParsed = ResultSchema.parse(refined);
          const refinedSum = refinedParsed.items.reduce(
            (acc, it) => acc + (it.total_price ?? 0),
            0,
          );
          const refinedDiff =
            Math.abs(refinedSum - refinedParsed.total_amount) / refinedParsed.total_amount;
          // Só substitui se o 2º passe melhorou a reconciliação.
          if (refinedDiff < diffPct) parsed = refinedParsed;
        } catch (err) {
          // Reconciliação é best-effort; mantém o 1º passe se o 2º falhar.
          console.warn("[OCR] passe de reconciliação falhou:", err);
        }
      }
    }

    return parsed;
  });
