import { supabase } from "@/integrations/supabase/client";

/**
 * Varredura periódica: encontra pares de `normalized_name` muito parecidos
 * no histórico do próprio usuário e registra em `sugestoes_unificacao` para
 * revisão manual. Não toca em pares já respondidos antes.
 *
 * Pares com similaridade >= AUTO_UNIFY_THRESHOLD são unificados
 * automaticamente (sem perguntar) — são casos seguros: tokens praticamente
 * idênticos, diferindo apenas em ordem ou stopwords.
 */

const AUTO_UNIFY_THRESHOLD = 0.92;
const REVIEW_THRESHOLD = 0.6;

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "com", "sem", "tipo", "kg", "g", "gr", "ml",
  "l", "un", "und", "unid", "unidade", "pacote", "pct", "fardo", "cx", "caixa",
  "lt", "lts", "ltr", "litro", "litros", "embalagem", "embal", "emb",
]);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tokenize(name: string): string[] {
  return stripAccents((name ?? "").toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  A.forEach((t) => {
    if (B.has(t)) inter += 1;
  });
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface DuplicateSuggestion {
  id: string;
  nome_a: string;
  nome_b: string;
  similaridade: number;
  status: "pendente" | "aceita" | "rejeitada";
  atualizado_em?: string;
}

export interface ScanResult {
  pending: DuplicateSuggestion[];
  autoUnified: number;
}

async function applyMerge(userId: string, canonical: string, other: string): Promise<void> {
  await Promise.all([
    supabase
      .from("expense_items")
      .update({ normalized_name: canonical })
      .eq("user_id", userId)
      .eq("normalized_name", other),
    supabase
      .from("product_prices")
      .update({ normalized_name: canonical })
      .eq("user_id", userId)
      .eq("normalized_name", other),
    supabase.from("product_aliases").upsert(
      {
        user_id: userId,
        alias_normalized: other,
        canonical_normalized: canonical,
        same_product: true,
      },
      { onConflict: "user_id,alias_normalized,canonical_normalized" },
    ),
  ]);
}

/**
 * Roda varredura no histórico, registra pares similares ainda não vistos
 * e auto-unifica os mais seguros. Retorna sugestões pendentes + contagem
 * dos itens unificados automaticamente.
 */
export async function scanDuplicates(userId: string): Promise<ScanResult> {
  const [{ data: names }, { data: aliases }, { data: existing }] = await Promise.all([
    supabase
      .from("expense_items")
      .select("normalized_name")
      .eq("user_id", userId)
      .not("normalized_name", "is", null)
      .limit(3000),
    supabase
      .from("product_aliases")
      .select("alias_normalized,canonical_normalized")
      .eq("user_id", userId),
    supabase
      .from("sugestoes_unificacao")
      .select("nome_a,nome_b")
      .eq("user_id", userId),
  ]);

  const unique = Array.from(
    new Set((names ?? []).map((r) => r.normalized_name as string).filter(Boolean)),
  );
  if (unique.length < 2) return { pending: [], autoUnified: 0 };

  const answered = new Set<string>();
  (aliases ?? []).forEach((a) =>
    answered.add([a.alias_normalized, a.canonical_normalized].sort().join("|")),
  );
  (existing ?? []).forEach((s) => answered.add([s.nome_a, s.nome_b].sort().join("|")));

  const tokens = unique.map((n) => ({ n, t: tokenize(n) }));
  const newRows: { user_id: string; nome_a: string; nome_b: string; similaridade: number }[] = [];
  const autoMerges: { canonical: string; other: string; score: number }[] = [];

  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const a = tokens[i];
      const b = tokens[j];
      if (a.t.length === 0 || b.t.length === 0) continue;
      const score = jaccard(a.t, b.t);
      if (score < REVIEW_THRESHOLD || score >= 1) continue;
      const k = [a.n, b.n].sort().join("|");
      if (answered.has(k)) continue;
      answered.add(k);
      const [nome_a, nome_b] = [a.n, b.n].sort();

      if (score >= AUTO_UNIFY_THRESHOLD) {
        // canônico = nome mais curto (geralmente o mais limpo)
        const canonical = nome_a.length <= nome_b.length ? nome_a : nome_b;
        const other = canonical === nome_a ? nome_b : nome_a;
        autoMerges.push({ canonical, other, score: Number(score.toFixed(3)) });
      } else {
        newRows.push({ user_id: userId, nome_a, nome_b, similaridade: Number(score.toFixed(3)) });
      }
    }
  }

  // Auto-unify safe matches and record them as "aceita" for traceability
  for (const m of autoMerges) {
    await applyMerge(userId, m.canonical, m.other);
    await supabase.from("sugestoes_unificacao").upsert(
      {
        user_id: userId,
        nome_a: [m.canonical, m.other].sort()[0],
        nome_b: [m.canonical, m.other].sort()[1],
        similaridade: m.score,
        status: "aceita",
      },
      { onConflict: "user_id,nome_a,nome_b", ignoreDuplicates: false },
    );
  }

  if (newRows.length > 0) {
    await supabase
      .from("sugestoes_unificacao")
      .upsert(newRows, { onConflict: "user_id,nome_a,nome_b", ignoreDuplicates: true });
  }

  const { data: pending } = await supabase
    .from("sugestoes_unificacao")
    .select("id,nome_a,nome_b,similaridade,status")
    .eq("user_id", userId)
    .eq("status", "pendente")
    .order("similaridade", { ascending: false });

  return {
    pending: (pending ?? []) as DuplicateSuggestion[],
    autoUnified: autoMerges.length,
  };
}

/** Aceita: renomeia B → A em expense_items e product_prices, marca aceita. */
export async function acceptUnification(
  userId: string,
  suggestionId: string,
  canonical: string,
  other: string,
): Promise<void> {
  await applyMerge(userId, canonical, other);
  await supabase
    .from("sugestoes_unificacao")
    .update({ status: "aceita" })
    .eq("id", suggestionId);
}

/** Rejeita: marca como rejeitada e grava no aprendizado para não perguntar de novo. */
export async function rejectUnification(
  userId: string,
  suggestionId: string,
  a: string,
  b: string,
): Promise<void> {
  await Promise.all([
    supabase.from("product_aliases").upsert(
      {
        user_id: userId,
        alias_normalized: a,
        canonical_normalized: b,
        same_product: false,
      },
      { onConflict: "user_id,alias_normalized,canonical_normalized" },
    ),
    supabase
      .from("sugestoes_unificacao")
      .update({ status: "rejeitada" })
      .eq("id", suggestionId),
  ]);
}

/** Lista decisões anteriores (aceitas + rejeitadas) para a página de exceções. */
export async function listDecisions(userId: string): Promise<DuplicateSuggestion[]> {
  const { data } = await supabase
    .from("sugestoes_unificacao")
    .select("id,nome_a,nome_b,similaridade,status,atualizado_em")
    .eq("user_id", userId)
    .in("status", ["aceita", "rejeitada"])
    .order("atualizado_em", { ascending: false })
    .limit(500);
  return (data ?? []) as DuplicateSuggestion[];
}

/**
 * Reverte uma decisão: remove o alias gravado e volta o status para pendente.
 * Não desfaz renomeações em expense_items (ficaria oneroso e ambíguo).
 */
export async function revertDecision(
  userId: string,
  suggestionId: string,
  a: string,
  b: string,
): Promise<void> {
  await Promise.all([
    supabase
      .from("product_aliases")
      .delete()
      .eq("user_id", userId)
      .or(
        `and(alias_normalized.eq.${a},canonical_normalized.eq.${b}),and(alias_normalized.eq.${b},canonical_normalized.eq.${a})`,
      ),
    supabase
      .from("sugestoes_unificacao")
      .update({ status: "pendente" })
      .eq("id", suggestionId),
  ]);
}
