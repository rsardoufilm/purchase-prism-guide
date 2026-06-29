// Dicionário aprendido de categorias por produto.
//
// Camadas (prioridade decrescente):
//   1. Dicionário PESSOAL — `dicionario_usuario` do próprio usuário autenticado.
//   2. Dicionário GLOBAL  — `dicionario_global` (apenas registros `aprovado=true`).
//
// O classificador fixo (regras + OCR) continua sendo aplicado depois disso.
//
// Captura: a cada edição manual de categoria de um item, o app chama
// `recordItemCorrection(rawName, categoria)` que faz UPSERT em `dicionario_usuario`
// e incrementa `confirmacoes`. Um gatilho no banco promove o termo para o
// dicionário global (aprovado=false) ao atingir 5 usuários distintos.

import { supabase } from "@/integrations/supabase/client";

/** Origem da sugestão pelo dicionário. */
export type DictionarySource = "pessoal" | "global";

/** Mapas em memória usados durante o pipeline de OCR / classificação. */
export interface LearnedDictionary {
  personal: Map<string, string>; // termo_normalizado → categoria
  global: Map<string, string>;
}

const EMPTY: LearnedDictionary = {
  personal: new Map(),
  global: new Map(),
};

/** Normaliza um nome de produto para chave estável (sem acento, lowercase, sem pontuação). */
export function normalizeTerm(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Carrega o dicionário pessoal + o global aprovado para o usuário autenticado.
 * Falhas silenciosas: o pipeline funciona mesmo sem dicionário (cai nas regras).
 */
export async function loadLearnedDictionary(): Promise<LearnedDictionary> {
  try {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return { personal: new Map(), global: new Map() };

    const [personalRes, globalRes] = await Promise.all([
      supabase
        .from("dicionario_usuario")
        .select("termo_normalizado,categoria_corrigida,confirmacoes,atualizado_em")
        .eq("user_id", uid)
        .order("confirmacoes", { ascending: false })
        .limit(2000),
      supabase
        .from("dicionario_global")
        .select("termo_normalizado,categoria_sugerida")
        .eq("aprovado", true)
        .limit(5000),
    ]);

    const personal = new Map<string, string>();
    for (const row of personalRes.data ?? []) {
      // Conflito entre regras pessoais para o mesmo termo: a primeira (maior
      // `confirmacoes`) vence; demais são ignoradas.
      if (!personal.has(row.termo_normalizado)) {
        personal.set(row.termo_normalizado, row.categoria_corrigida);
      }
    }

    const globalMap = new Map<string, string>();
    for (const row of globalRes.data ?? []) {
      if (!globalMap.has(row.termo_normalizado)) {
        globalMap.set(row.termo_normalizado, row.categoria_sugerida);
      }
    }

    return { personal, global: globalMap };
  } catch {
    return EMPTY;
  }
}

/**
 * Sugere uma categoria para `rawName` consultando, nesta ordem,
 * o dicionário pessoal e depois o global aprovado.
 * Retorna `null` quando nenhum dicionário cobre o termo.
 */
export function suggestFromDictionary(
  rawName: string,
  dict: LearnedDictionary,
): { category: string; source: DictionarySource } | null {
  const key = normalizeTerm(rawName);
  if (!key) return null;
  const personal = dict.personal.get(key);
  if (personal) return { category: personal, source: "pessoal" };
  const global = dict.global.get(key);
  if (global) return { category: global, source: "global" };
  return null;
}

/**
 * Registra (UPSERT) uma correção de categoria feita pelo usuário.
 *
 * Comportamento:
 *  - Se já existe linha (mesmo usuário, mesmo termo, mesma categoria):
 *    incrementa `confirmacoes`.
 *  - Caso contrário: insere com `confirmacoes = 1`.
 *
 * Outras correções concorrentes para o mesmo termo (com OUTRA categoria) são
 * preservadas — a leitura escolhe a de maior `confirmacoes` (vide
 * `loadLearnedDictionary`).
 *
 * Toda essa operação respeita RLS: a inserção é validada pela política
 * `auth.uid() = user_id`.
 */
export async function recordItemCorrection(
  rawName: string,
  categoria: string,
  opts?: { nomeCorrigido?: string | null },
): Promise<void> {
  const termo = (rawName ?? "").trim();
  const cat = (categoria ?? "").trim();
  if (!termo || !cat) return;
  const termoNorm = normalizeTerm(termo);
  if (!termoNorm) return;

  try {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;

    // Tenta atualizar primeiro (incrementa confirmacoes).
    const { data: existing, error: selErr } = await supabase
      .from("dicionario_usuario")
      .select("id,confirmacoes")
      .eq("user_id", uid)
      .eq("termo_normalizado", termoNorm)
      .eq("categoria_corrigida", cat)
      .maybeSingle();
    if (selErr) return;

    if (existing) {
      await supabase
        .from("dicionario_usuario")
        .update({
          confirmacoes: existing.confirmacoes + 1,
          nome_corrigido: opts?.nomeCorrigido ?? undefined,
        })
        .eq("id", existing.id);
      return;
    }

    await supabase.from("dicionario_usuario").insert({
      user_id: uid,
      termo_original: termo,
      termo_normalizado: termoNorm,
      categoria_corrigida: cat,
      nome_corrigido: opts?.nomeCorrigido ?? null,
      confirmacoes: 1,
    });
  } catch {
    // Sem feedback ao usuário: aprendizado é melhor-esforço.
  }
}
