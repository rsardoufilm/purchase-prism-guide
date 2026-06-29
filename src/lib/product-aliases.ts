import { supabase } from "@/integrations/supabase/client";

/**
 * Aprendizado de produtos equivalentes.
 *
 * Detecta nomes parecidos (ex.: "Coração da Alcatra bovino" e "Coração bovino")
 * que podem ser o mesmo produto e pergunta ao usuário antes de unificar.
 * As respostas (positivas e negativas) ficam persistidas em `product_aliases`
 * para que o sistema não pergunte de novo nem confunda dois itens distintos.
 */

const STOPWORDS = new Set([
  "de","da","do","das","dos","com","sem","tipo","kg","g","gr","ml","l","un","und",
  "und.","unid","unidade","pacote","pct","fardo","cx","caixa","lt","lts","ltr",
  "litro","litros","grama","gramas","kilo","kilos","quilo","quilos","embalagem",
  "embal","emb","fresco","fresca","natural","integral","tradicional","puro","pura",
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

export type AliasMap = Map<string, { canonical: string; same: boolean }>;

export async function loadAliases(userId: string): Promise<AliasMap> {
  const { data, error } = await supabase
    .from("product_aliases")
    .select("alias_normalized,canonical_normalized,same_product")
    .eq("user_id", userId);
  const m: AliasMap = new Map();
  if (error || !data) return m;
  for (const row of data) {
    m.set(`${row.alias_normalized}=>${row.canonical_normalized}`, {
      canonical: row.canonical_normalized,
      same: row.same_product,
    });
  }
  return m;
}

function key(alias: string, canonical: string): string {
  return `${alias}=>${canonical}`;
}

/** Aplica apelidos confirmados: troca alias por canonical. */
export function applyAliases(name: string, aliases: AliasMap): string {
  for (const [k, v] of aliases) {
    const [alias] = k.split("=>");
    if (alias === name && v.same) return v.canonical;
  }
  return name;
}

export interface AliasCandidate {
  /** Índice do item no draft */
  index: number;
  /** Nome novo trazido pelo OCR/usuário */
  newName: string;
  /** Nome canônico já existente no histórico */
  existingName: string;
  /** 0..1 — similaridade textual */
  similarity: number;
}

/**
 * Detecta candidatos a alias entre os itens do draft e os nomes já existentes
 * no histórico do próprio usuário. Não pergunta sobre pares já registrados
 * (positivos ou negativos).
 */
export async function detectAliasCandidates(
  userId: string,
  items: Array<{ normalized_name?: string | null; raw_name: string }>,
): Promise<AliasCandidate[]> {
  const aliases = await loadAliases(userId);

  const { data: hist } = await supabase
    .from("expense_items")
    .select("normalized_name")
    .eq("user_id", userId)
    .not("normalized_name", "is", null)
    .limit(2000);

  const known = Array.from(
    new Set((hist ?? []).map((r) => r.normalized_name as string).filter(Boolean)),
  );
  const knownTokens = known.map((n) => ({ n, t: tokenize(n) }));

  const candidates: AliasCandidate[] = [];
  const seenPairs = new Set<string>();

  items.forEach((it, idx) => {
    const newName = (it.normalized_name ?? it.raw_name ?? "").trim();
    if (!newName) return;
    const newTok = tokenize(newName);
    if (newTok.length === 0) return;

    let best: { n: string; score: number } | null = null;
    for (const k of knownTokens) {
      if (k.n === newName) {
        best = { n: k.n, score: 1 };
        break;
      }
      const score = jaccard(newTok, k.t);
      if (score >= 0.5 && (!best || score > best.score)) {
        best = { n: k.n, score };
      }
    }
    if (!best || best.score >= 1) return; // exato → nada a perguntar

    // Já foi respondido antes (em qualquer direção)?
    if (
      aliases.has(key(newName, best.n)) ||
      aliases.has(key(best.n, newName))
    ) {
      return;
    }

    const pairKey = [newName, best.n].sort().join("|");
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);

    candidates.push({
      index: idx,
      newName,
      existingName: best.n,
      similarity: best.score,
    });
  });

  return candidates;
}

export async function saveAlias(
  userId: string,
  aliasName: string,
  canonicalName: string,
  same: boolean,
): Promise<void> {
  await supabase.from("product_aliases").upsert(
    {
      user_id: userId,
      alias_normalized: aliasName,
      canonical_normalized: canonicalName,
      same_product: same,
    },
    { onConflict: "user_id,alias_normalized,canonical_normalized" },
  );
}
