// Dicionário aprendido de categorias por produto.
//
// Camadas (prioridade decrescente):
//   1. Dicionário PESSOAL — `dicionario_usuario` do próprio usuário autenticado.
//   2. Dicionário GLOBAL  — `dicionario_global` (apenas registros `aprovado=true`).
//
// Captura: a cada edição manual de categoria de um item, o app chama
// `recordItemCorrection(rawName, categoria)` que faz UPSERT em `dicionario_usuario`
// e incrementa `confirmacoes`.
//
// Lookup: além de igualdade exata por chave normalizada, também aplica
// correspondência por SIMILARIDADE — ignora acentos, caixa e espaços extras,
// e considera substring/contém-token, para que variações como
// "sacola 40x50" sejam unificadas ao termo canônico "sacola".

import { supabase } from "@/integrations/supabase/client";

export type DictionarySource = "pessoal" | "global";

export interface DictionaryEntry {
  category: string;
  /** Nome canônico/corrigido (quando registrado). */
  name: string | null;
}

export interface LearnedDictionary {
  personal: Map<string, DictionaryEntry>;
  global: Map<string, DictionaryEntry>;
  /** Lista ordenada (chave mais longa primeiro) para casamento por substring. */
  personalKeys: string[];
  globalKeys: string[];
}

const EMPTY: LearnedDictionary = {
  personal: new Map(),
  global: new Map(),
  personalKeys: [],
  globalKeys: [],
};

/** Normaliza um termo: sem acento, lowercase, sem pontuação, espaços colapsados. */
export function normalizeTerm(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sortedKeys(map: Map<string, unknown>): string[] {
  return Array.from(map.keys()).sort((a, b) => b.length - a.length);
}

export async function loadLearnedDictionary(): Promise<LearnedDictionary> {
  try {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return EMPTY;

    const [personalRes, globalRes] = await Promise.all([
      supabase
        .from("dicionario_usuario")
        .select("termo_normalizado,categoria_corrigida,nome_corrigido,confirmacoes")
        .eq("user_id", uid)
        .order("confirmacoes", { ascending: false })
        .limit(2000),
      supabase
        .from("dicionario_global")
        .select("termo_normalizado,categoria_sugerida,nome_sugerido")
        .eq("aprovado", true)
        .limit(5000),
    ]);

    const personal = new Map<string, DictionaryEntry>();
    for (const row of personalRes.data ?? []) {
      if (!personal.has(row.termo_normalizado)) {
        personal.set(row.termo_normalizado, {
          category: row.categoria_corrigida,
          name: row.nome_corrigido ?? null,
        });
      }
    }

    const globalMap = new Map<string, DictionaryEntry>();
    for (const row of globalRes.data ?? []) {
      if (!globalMap.has(row.termo_normalizado)) {
        globalMap.set(row.termo_normalizado, {
          category: row.categoria_sugerida,
          name: row.nome_sugerido ?? null,
        });
      }
    }

    return {
      personal,
      global: globalMap,
      personalKeys: sortedKeys(personal),
      globalKeys: sortedKeys(globalMap),
    };
  } catch {
    return EMPTY;
  }
}

function lookup(
  norm: string,
  map: Map<string, DictionaryEntry>,
  keys: string[],
): DictionaryEntry | null {
  if (!norm) return null;
  // 1. Exato.
  const exact = map.get(norm);
  if (exact) return exact;
  // 2. Substring (chave dentro do termo, ex.: "sacola" em "sacola 40x50").
  for (const k of keys) {
    if (k.length < 3) continue;
    if (norm === k) return map.get(k) ?? null;
    if (norm.includes(k)) {
      // Garante que é palavra inteira, não pedaço (ex.: "sal" ≠ "salgado").
      const re = new RegExp(`(^|\\s)${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`);
      if (re.test(norm)) return map.get(k) ?? null;
    }
  }
  return null;
}

/**
 * Sugere categoria/nome consultando dicionário pessoal e depois global.
 * Faz correspondência por similaridade (acento/caixa/substring de palavra).
 */
export function suggestFromDictionary(
  rawName: string,
  dict: LearnedDictionary,
): { category: string; name: string | null; source: DictionarySource } | null {
  const key = normalizeTerm(rawName);
  if (!key) return null;
  const p = lookup(key, dict.personal, dict.personalKeys);
  if (p) return { category: p.category, name: p.name, source: "pessoal" };
  const g = lookup(key, dict.global, dict.globalKeys);
  if (g) return { category: g.category, name: g.name, source: "global" };
  return null;
}

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
    // Aprendizado é melhor-esforço.
  }
}
