import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  question: z.string().trim().min(2).max(500),
});

const SYSTEM_PROMPT = `Você é o assistente da AURA Finance. Responda APENAS com base nos dados do usuário fornecidos no contexto.

REGRAS OBRIGATÓRIAS:
- NUNCA invente informações.
- Se a resposta não estiver nos dados, diga: "Não encontrei isso nos seus registros".
- Responda em português brasileiro, curto e direto.
- Valores em reais (R$ 0,00).
- Não use conhecimento externo.
- Foque em consumo, gastos, hábitos e oportunidades de economia.`;

export const askAura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const { supabase } = context;

    // Últimos 6 meses de dados (RLS garante user-only)
    const since = new Date();
    since.setMonth(since.getMonth() - 6);
    const sinceStr = since.toISOString().slice(0, 10);

    const [exp, items, recur, subs] = await Promise.all([
      supabase
        .from("expenses")
        .select("expense_date,merchant_name,category,total_amount,payment_method")
        .gte("expense_date", sinceStr)
        .order("expense_date", { ascending: false })
        .limit(500),
      supabase
        .from("expense_items")
        .select("normalized_name,category,quantity,unit,unit_price,total_price")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("recurring_expenses").select("name,category,amount,frequency,active"),
      supabase.from("subscriptions").select("name,amount,frequency,active"),
    ]);

    const ctx = {
      periodo_consultado: `últimos 6 meses (desde ${sinceStr})`,
      despesas: exp.data ?? [],
      itens: items.data ?? [],
      contas_recorrentes: recur.data ?? [],
      assinaturas: subs.data ?? [],
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `DADOS DO USUÁRIO (JSON):\n${JSON.stringify(ctx).slice(0, 80_000)}\n\nPERGUNTA: ${data.question}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("Muitas perguntas. Tente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`IA falhou: ${t.slice(0, 200)}`);
    }
    const body = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return { answer: body.choices?.[0]?.message?.content ?? "Sem resposta." };
  });
