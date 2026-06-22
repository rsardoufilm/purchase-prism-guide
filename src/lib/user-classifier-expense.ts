// Aprendizado de associação estabelecimento→categoria da despesa.
// Espelha user-classifier.ts mas opera sobre a tabela expenses.

import { supabase } from "@/integrations/supabase/client";

export type LearnedExpenseEntry = {
  category: string;
  count: number;
  lastSeen: string;
  sample: string;
};

export type UserExpenseCategoryMap = {
  byMerchant: Map<string, LearnedExpenseEntry>;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function loadUserExpenseCategoryMap(): Promise<UserExpenseCategoryMap> {
  const empty: UserExpenseCategoryMap = { byMerchant: new Map() };
  try {
    const { data, error } = await supabase
      .from("expenses")
      .select("merchant_name,category,created_at")
      .not("category", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error || !data) return empty;

    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    type Bucket = Map<string, { count: number; lastSeen: string; sample: string }>;
    const m = new Map<string, Bucket>();

    for (const row of data) {
      const cat = (row.category ?? "").trim();
      const merch = (row.merchant_name ?? "").trim();
      if (!cat || !merch) continue;
      const key = normalize(merch);
      const when = row.created_at ?? new Date().toISOString();
      const w = new Date(when).getTime() >= cutoff ? 2 : 1;
      let inner = m.get(key);
      if (!inner) {
        inner = new Map();
        m.set(key, inner);
      }
      const cur = inner.get(cat) ?? { count: 0, lastSeen: when, sample: merch };
      cur.count += w;
      if (when > cur.lastSeen) cur.lastSeen = when;
      inner.set(cat, cur);
    }

    const out = new Map<string, LearnedExpenseEntry>();
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
    return { byMerchant: out };
  } catch {
    return empty;
  }
}

export function suggestExpenseCategory(
  merchantName: string,
  map: UserExpenseCategoryMap,
): string | null {
  if (!merchantName) return null;
  return map.byMerchant.get(normalize(merchantName))?.category ?? null;
}

export async function clearLearnedExpense(merchantNormalized: string): Promise<number> {
  const { data: rows, error } = await supabase
    .from("expenses")
    .select("id,merchant_name")
    .not("category", "is", null)
    .limit(2000);
  if (error || !rows) return 0;
  const ids = rows
    .filter((r) => normalize(r.merchant_name ?? "") === merchantNormalized)
    .map((r) => r.id);
  if (!ids.length) return 0;
  const { error: e2 } = await supabase
    .from("expenses")
    .update({ category: null })
    .in("id", ids);
  if (e2) return 0;
  return ids.length;
}

export async function relabelLearnedExpense(
  merchantNormalized: string,
  newCategory: string,
): Promise<number> {
  const { data: rows, error } = await supabase
    .from("expenses")
    .select("id,merchant_name")
    .limit(2000);
  if (error || !rows) return 0;
  const ids = rows
    .filter((r) => normalize(r.merchant_name ?? "") === merchantNormalized)
    .map((r) => r.id);
  if (!ids.length) return 0;
  const { error: e2 } = await supabase
    .from("expenses")
    .update({ category: newCategory })
    .in("id", ids);
  if (e2) return 0;
  return ids.length;
}

export { normalize as normalizeMerchantKey };
