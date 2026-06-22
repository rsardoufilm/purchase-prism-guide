// Aprendizado de associação produto→categoria a partir do histórico do usuário.
// Constrói um mapa Map<chave, categoria> a partir de expense_items já categorizados,
// usando a categoria mais frequente por (raw_name normalizado) e por tokens.
// Itens dos últimos 30 dias têm peso dobrado (reforço de aprendizado recente).

import { supabase } from "@/integrations/supabase/client";

export type LearnedEntry = {
  category: string;
  count: number;
  lastSeen: string; // ISO
  sample: string; // raw_name representativo
};

export type UserCategoryMap = {
  byRaw: Map<string, LearnedEntry>;
  byToken: Map<string, LearnedEntry>;
};

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "com", "sem", "para",
  "kg", "g", "ml", "l", "un", "und", "pct", "cx", "pc", "ref",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/** Carrega histórico do usuário autenticado e devolve mapas de associação. */
export async function loadUserCategoryMap(): Promise<UserCategoryMap> {
  const empty: UserCategoryMap = { byRaw: new Map(), byToken: new Map() };
  try {
    const { data, error } = await supabase
      .from("expense_items")
      .select("raw_name,category,created_at")
      .not("category", "is", null)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error || !data) return empty;

    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;

    type Bucket = Map<string, { count: number; lastSeen: string; sample: string }>;
    const countRaw = new Map<string, Bucket>();
    const countTok = new Map<string, Bucket>();

    const bump = (
      m: Map<string, Bucket>,
      key: string,
      cat: string,
      weight: number,
      when: string,
      sample: string,
    ) => {
      let inner = m.get(key);
      if (!inner) {
        inner = new Map();
        m.set(key, inner);
      }
      const cur = inner.get(cat) ?? { count: 0, lastSeen: when, sample };
      cur.count += weight;
      if (when > cur.lastSeen) cur.lastSeen = when;
      inner.set(cat, cur);
    };

    for (const row of data) {
      const cat = (row.category ?? "").trim();
      const raw = (row.raw_name ?? "").trim();
      if (!cat || !raw) continue;
      const when = row.created_at ?? new Date().toISOString();
      const recent = new Date(when).getTime() >= cutoff;
      const w = recent ? 2 : 1;
      bump(countRaw, normalize(raw), cat, w, when, raw);
      for (const tok of tokenize(raw)) bump(countTok, tok, cat, w, when, raw);
    }

    const finalize = (m: Map<string, Bucket>): Map<string, LearnedEntry> => {
      const out = new Map<string, LearnedEntry>();
      for (const [key, cats] of m) {
        let bestCat = "";
        let bestN = 0;
        let bestSeen = "";
        let bestSample = "";
        for (const [c, info] of cats) {
          if (info.count > bestN) {
            bestN = info.count;
            bestCat = c;
            bestSeen = info.lastSeen;
            bestSample = info.sample;
          }
        }
        if (bestCat) {
          out.set(key, {
            category: bestCat,
            count: Math.round(bestN),
            lastSeen: bestSeen,
            sample: bestSample,
          });
        }
      }
      return out;
    };

    return { byRaw: finalize(countRaw), byToken: finalize(countTok) };
  } catch {
    return empty;
  }
}

/** Sugere categoria a partir do histórico do usuário; null se não souber. */
export function suggestCategory(rawName: string, map: UserCategoryMap): string | null {
  if (!rawName) return null;
  const key = normalize(rawName);
  const direct = map.byRaw.get(key);
  if (direct) return direct.category;
  for (const tok of tokenize(rawName)) {
    const hit = map.byToken.get(tok);
    if (hit) return hit.category;
  }
  return null;
}

/** Origem informativa da sugestão atual: 'raw' = match exato, 'token' = match parcial. */
export function suggestSource(
  rawName: string,
  map: UserCategoryMap,
): "raw" | "token" | null {
  if (!rawName) return null;
  const key = normalize(rawName);
  if (map.byRaw.has(key)) return "raw";
  for (const tok of tokenize(rawName)) {
    if (map.byToken.has(tok)) return "token";
  }
  return null;
}

/** Remove o aprendizado para um raw_name: zera category nos expense_items correspondentes. */
export async function clearLearnedItem(rawNameNormalized: string): Promise<number> {
  const { data: rows, error } = await supabase
    .from("expense_items")
    .select("id,raw_name")
    .not("category", "is", null)
    .limit(2000);
  if (error || !rows) return 0;
  const ids = rows
    .filter((r) => normalize(r.raw_name ?? "") === rawNameNormalized)
    .map((r) => r.id);
  if (!ids.length) return 0;
  const { error: e2 } = await supabase
    .from("expense_items")
    .update({ category: null })
    .in("id", ids);
  if (e2) return 0;
  return ids.length;
}

/** Reatribui o aprendizado: substitui category nos expense_items do mesmo raw_name. */
export async function relabelLearnedItem(
  rawNameNormalized: string,
  newCategory: string,
): Promise<number> {
  const { data: rows, error } = await supabase
    .from("expense_items")
    .select("id,raw_name")
    .limit(2000);
  if (error || !rows) return 0;
  const ids = rows
    .filter((r) => normalize(r.raw_name ?? "") === rawNameNormalized)
    .map((r) => r.id);
  if (!ids.length) return 0;
  const { error: e2 } = await supabase
    .from("expense_items")
    .update({ category: newCategory })
    .in("id", ids);
  if (e2) return 0;
  return ids.length;
}

export { normalize as normalizeKey };
