import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  fileDataUrl: z.string().min(20).max(15_000_000), // data:...;base64,...
  mimeType: z.string().min(3).max(100),
});

const ItemSchema = z.object({
  description: z.string(),
  normalized_product: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  unit_price: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
});

const ResultSchema = z.object({
  merchant: z.string(),
  category: z.string().nullable().optional(),
  purchased_at: z.string().nullable().optional(),
  total: z.number(),
  payment_method: z
    .enum(["pix", "credito", "debito", "dinheiro", "vale_alimentacao", "vale_refeicao", "outros"])
    .default("outros"),
  items: z.array(ItemSchema).default([]),
});

export type OcrResult = z.infer<typeof ResultSchema>;

const SYSTEM_PROMPT = `Você é um extrator de notas fiscais brasileiras (NFC-e/NF-e/cupons fiscais).
Extraia os dados em JSON ESTRITO no schema:
{
  "merchant": string,                // nome do estabelecimento
  "category": string|null,           // categoria do estabelecimento (ex: "Supermercado", "Combustível", "Restaurante", "Farmácia")
  "purchased_at": string|null,       // ISO 8601 com fuso -03:00 se possível
  "total": number,                   // valor total da nota (numérico, ponto como decimal)
  "payment_method": "pix"|"credito"|"debito"|"dinheiro"|"vale_alimentacao"|"vale_refeicao"|"outros",
  "items": [
    {
      "description": string,         // descrição original
      "normalized_product": string|null, // produto normalizado (ex: "Arroz", "Pães", "Leite", "Café")
      "category": string|null,       // categoria do item (ex: "Alimentos", "Bebidas", "Limpeza")
      "quantity": number|null,
      "unit": string|null,           // "kg","g","l","ml","un","cx","pct","dz"
      "unit_price": number|null,
      "total": number|null
    }
  ]
}

Regras:
- normalized_product agrupa equivalentes: "ARROZ TIPO 1 5KG" → "Arroz"; "PÃO FRANCÊS" → "Pães"; "COCA COLA 2L" → "Refrigerante".
- Use número decimal com ponto (ex: 12.90). NUNCA strings.
- Se um campo não estiver claro, retorne null.
- Responda APENAS com o objeto JSON, sem markdown.`;

export const ocrReceipt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const isImage = data.mimeType.startsWith("image/");
    const isPdf = data.mimeType === "application/pdf";
    if (!isImage && !isPdf) {
      throw new Error("Apenas imagens ou PDF são aceitos");
    }

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
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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

    const body = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const raw = body.choices?.[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const cleaned = raw.replace(/```json\s*|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    }
    return ResultSchema.parse(parsed);
  });
