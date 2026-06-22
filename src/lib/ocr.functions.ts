import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  fileDataUrl: z.string().min(20).max(15_000_000),
  mimeType: z.string().min(3).max(100),
});

const ItemSchema = z.object({
  raw_name: z.string(),
  normalized_name: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  unit_price: z.number().nullable().optional(),
  total_price: z.number().nullable().optional(),
});

const ResultSchema = z.object({
  merchant_name: z.string(),
  merchant_document: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  expense_date: z.string().nullable().optional(), // YYYY-MM-DD
  expense_time: z.string().nullable().optional(), // HH:MM or HH:MM:SS
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

const SYSTEM_PROMPT = `Você é um extrator OCR especialista em notas fiscais brasileiras (NFC-e/NF-e/cupons fiscais).
Extraia os dados em JSON ESTRITO com este schema:
{
  "merchant_name": string,
  "merchant_document": string|null,        // CNPJ se identificável (apenas dígitos com pontuação ou só dígitos)
  "category": string|null,                 // uma de: ${CATEGORIES.join(", ")}
  "expense_date": string|null,             // formato YYYY-MM-DD
  "expense_time": string|null,             // formato HH:MM:SS
  "total_amount": number,                  // valor total (numérico, ponto decimal)
  "payment_method": "pix"|"credito"|"debito"|"dinheiro"|"vale_alimentacao"|"vale_refeicao"|"outros",
  "items": [
    {
      "raw_name": string,                  // descrição original do cupom
      "normalized_name": string|null,      // forma normalizada agrupando equivalentes (ex: "ARROZ TIPO 1 5KG" → "Arroz", "COCA COLA 2L" → "Refrigerante", "PÃO FRANCÊS" → "Pães")
      "category": string|null,             // uma das categorias acima
      "quantity": number|null,
      "unit": string|null,                 // "kg","g","l","ml","un","cx","pct","dz"
      "unit_price": number|null,
      "total_price": number|null
    }
  ]
}

Regras críticas:
- Todos os valores numéricos com ponto decimal (12.90), NUNCA strings.
- normalized_name agrupa variações do mesmo produto.
- Se um campo não estiver claro, use null.
- Responda APENAS o objeto JSON, sem markdown.`;

export const ocrReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const isImage = data.mimeType.startsWith("image/");
    const isPdf = data.mimeType === "application/pdf";
    if (!isImage && !isPdf) throw new Error("Apenas imagens ou PDF são aceitos");

    const userContent: Array<Record<string, unknown>> = [
      { type: "text", text: "Extraia esta nota fiscal e responda apenas com o JSON." },
    ];
    if (isImage) {
      userContent.push({ type: "image_url", image_url: { url: data.fileDataUrl } });
    } else {
      const base64 = data.fileDataUrl.split(",")[1] ?? data.fileDataUrl;
      userContent.push({
        type: "file",
        file: { filename: "nota.pdf", file_data: `data:application/pdf;base64,${base64}` },
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = JSON.parse(raw.replace(/```json\s*|```/g, "").trim());
    }
    return ResultSchema.parse(parsed);
  });
