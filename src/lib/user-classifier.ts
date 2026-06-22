// Aprendizado de associação produto→categoria a partir do histórico do usuário.
// Constrói um mapa Map<chave, categoria> a partir de expense_items já categorizados,
// usando a categoria mais frequente por (raw_name normalizado) e por tokens.

import { supabase } from "@/integrations/supabase/client";

export type UserCategoryMap = {
  byRaw: Map<string, string>; // chave: raw_name normalizado completo
  byToken: Map<string, string>; // chave: token significativo (>=4 chars)
};

const STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "com",
  "sem",
  "para",
  "kg",
  "g",
  "ml",
  "l",
  "un",
  "und",
  "pct",
  "cx",
  "pc",
  "ref",
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
      .select("raw_name,category")
      .not("category", "is", null)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error || !data) return empty;

    // contagem por (chave, categoria) para escolher a moda
    const countRaw = new Map<string, Map<string, number>>();
    const countTok = new Map<string, Map<string, number>>();
    const bump = (m: Map<string, Map<string, number>>, key: string, cat: string) => {
      let inner = m.get(key);
      if (!inner) {
        inner = new Map();
        m.set(key, inner);
      }
      inner.set(cat, (inner.get(cat) ?? 0) + 1);
    };

    for (const row of data) {
      const cat = (row.category ?? "").trim();
      const raw = (row.raw_name ?? "").trim();
      if (!cat || !raw) continue;
      bump(countRaw, normalize(raw), cat);
      for (const tok of tokenize(raw)) bump(countTok, tok, cat);
    }

    const finalize = (m: Map<string, Map<string, number>>): Map<string, string> => {
      const out = new Map<string, string>();
      for (const [key, cats] of m) {
        let best = "";
        let bestN = 0;
        for (const [c, n] of cats) {
          if (n > bestN) {
            best = c;
            bestN = n;
          }
        }
        if (best) out.set(key, best);
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
  if (direct) return direct;
  for (const tok of tokenize(rawName)) {
    const hit = map.byToken.get(tok);
    if (hit) return hit;
  }
  return null;
}
