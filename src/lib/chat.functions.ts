import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  question: z.string().trim().min(2).max(500),
  /** ISO date (YYYY-MM-DD). null = sem limite. */
  start: z.string().nullable().optional(),
  end: z.string().nullable().optional(),
  /** Rótulo humano do período (ex.: "Junho 2026", "Últimos 30 dias"). */
  periodLabel: z.string().min(1).max(60).default("Todo o histórico"),
});

const SYSTEM_PROMPT = `Você é o assistente da AURA Consumo. Responda APENAS com base no bloco "FATOS PRÉ-CALCULADOS" e nos registros do usuário fornecidos.

REGRAS OBRIGATÓRIAS:
- NUNCA invente, NUNCA estime, NUNCA recalcule somas. Os valores em "FATOS PRÉ-CALCULADOS" são definitivos — copie-os literalmente.
- Para totais por categoria, total geral, contagem de despesas, top produto e top estabelecimento, use SEMPRE os números do bloco FATOS, mesmo que pareçam não bater com sua intuição.
- TODA resposta deve começar mencionando o período consultado (ex.: "No período Junho 2026, …").
- Se a informação não estiver nos FATOS ou nos registros, diga: "Não encontrei isso nos seus registros para <período>".
- Português brasileiro, curto e direto. Valores em reais (R$ 0,00).
- Sem conhecimento externo.`;

/** Normaliza chave de categoria (case e acentos). */
function normCat(s: string | null | undefined): string {
  return (s ?? "Sem categoria")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export const askAura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const { supabase } = context;
    const start = data.start ?? null;
    const end = data.end ?? null;

    // ============================================================
    // Fonte ÚNICA de verdade: aplica o mesmo filtro de período que
    // a aba Insights usa. RLS garante user-only.
    // ============================================================
    let expQ = supabase
      .from("expenses")
      .select("id,expense_date,merchant_name,category,total_amount,payment_method")
      .order("expense_date", { ascending: false })
      .limit(2000);
    if (start) expQ = expQ.gte("expense_date", start);
    if (end) expQ = expQ.lte("expense_date", end);

    const [exp, recur, subs] = await Promise.all([
      expQ,
      supabase.from("recurring_expenses").select("name,category,amount,frequency,active"),
      supabase.from("subscriptions").select("name,amount,frequency,active"),
    ]);

    const expenses = exp.data ?? [];
    const expenseIds = expenses.map((e) => e.id);

    // Itens só das despesas do período (consistência com Insights).
    let items: Array<{
      normalized_name: string | null;
      raw_name: string | null;
      category: string | null;
      quantity: number | null;
      unit: string | null;
      unit_price: number | null;
      total_price: number | null;
      expense_id: string;
    }> = [];
    if (expenseIds.length > 0) {
      const { data: itData } = await supabase
        .from("expense_items")
        .select(
          "normalized_name,raw_name,category,quantity,unit,unit_price,total_price,expense_id",
        )
        .in("expense_id", expenseIds)
        .limit(5000);
      items = itData ?? [];
    }

    // ---------- Agregações (idênticas às da aba Insights) ----------
    const totalGeral = expenses.reduce((s, r) => s + Number(r.total_amount), 0);

    const catMap = new Map<string, { label: string; total: number; count: number }>();
    for (const r of expenses) {
      const label = (r.category && r.category.trim()) || "Sem categoria";
      const k = normCat(label);
      const cur = catMap.get(k) ?? { label, total: 0, count: 0 };
      cur.total += Number(r.total_amount);
      cur.count += 1;
      catMap.set(k, cur);
    }
    const porCategoria = [...catMap.values()]
      .sort((a, b) => b.total - a.total)
      .map((c) => ({
        categoria: c.label,
        total: Number(c.total.toFixed(2)),
        despesas: c.count,
      }));

    const merchMap = new Map<string, { total: number; count: number }>();
    for (const r of expenses) {
      const cur = merchMap.get(r.merchant_name) ?? { total: 0, count: 0 };
      cur.total += Number(r.total_amount);
      cur.count += 1;
      merchMap.set(r.merchant_name, cur);
    }
    const porEstabelecimento = [...merchMap.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([m, v]) => ({
        estabelecimento: m,
        total: Number(v.total.toFixed(2)),
        visitas: v.count,
      }));

    const prodMap = new Map<string, number>();
    for (const it of items) {
      const name = (it.normalized_name ?? it.raw_name ?? "").trim();
      if (!name) continue;
      prodMap.set(name, (prodMap.get(name) ?? 0) + Number(it.total_price ?? 0));
    }
    const topProdutos = [...prodMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([n, v]) => ({ produto: n, total_gasto: Number(v.toFixed(2)) }));

    const fatos = {
      periodo: data.periodLabel,
      periodo_inicio: start,
      periodo_fim: end,
      total_geral: Number(totalGeral.toFixed(2)),
      numero_despesas: expenses.length,
      por_categoria: porCategoria,
      por_estabelecimento: porEstabelecimento,
      top_produtos: topProdutos,
    };

    // Contexto bruto enxuto (para perguntas que não envolvem totais).
    const ctx = {
      despesas_recentes: expenses.slice(0, 80).map((r) => ({
        data: r.expense_date,
        loja: r.merchant_name,
        categoria: r.category,
        total: Number(r.total_amount),
        pagamento: r.payment_method,
      })),
      contas_recorrentes: recur.data ?? [],
      assinaturas: subs.data ?? [],
    };

    const userBlock =
      `FATOS PRÉ-CALCULADOS (USE LITERALMENTE — período: ${data.periodLabel}):\n` +
      JSON.stringify(fatos) +
      `\n\nREGISTROS DETALHADOS (consulta auxiliar):\n` +
      JSON.stringify(ctx).slice(0, 60_000) +
      `\n\nPERGUNTA: ${data.question}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userBlock },
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
