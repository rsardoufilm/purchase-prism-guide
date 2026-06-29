// Filtros de "destaques" — exclui categorias e produtos marcados como
// ignorados nos rankings (Dashboard, Insights, Chat) sem afetar histórico.
import { supabase } from "@/integrations/supabase/client";

/** Normaliza nome para comparação case/acento-insensitiva. */
export function normalizeProductKey(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export interface HighlightFilters {
  ignoredCategories: Set<string>; // chave: categoria lowercase
  ignoredProducts: Set<string>; // chave: normalizeProductKey
}

const EMPTY: HighlightFilters = {
  ignoredCategories: new Set(),
  ignoredProducts: new Set(),
};

/** Carrega ambas as listas do usuário corrente. Resiliente a falhas. */
export async function loadHighlightFilters(): Promise<HighlightFilters> {
  try {
    const [cats, prods] = await Promise.all([
      supabase.from("categorias_ignoradas_destaques").select("categoria"),
      supabase.from("produtos_ignorados_destaques").select("nome_normalizado"),
    ]);
    return {
      ignoredCategories: new Set(
        (cats.data ?? []).map((r) => (r.categoria ?? "").trim().toLowerCase()),
      ),
      ignoredProducts: new Set((prods.data ?? []).map((r) => r.nome_normalizado)),
    };
  } catch {
    return EMPTY;
  }
}

/** True se o item deve aparecer em rankings/destaques. */
export function isHighlightable(
  filters: HighlightFilters,
  productName: string | null | undefined,
  category: string | null | undefined,
): boolean {
  const cat = (category ?? "").trim().toLowerCase();
  if (cat && filters.ignoredCategories.has(cat)) return false;
  const prod = normalizeProductKey(productName);
  if (prod && filters.ignoredProducts.has(prod)) return false;
  return true;
}

/** Alterna o estado "ignorado" de um produto para o usuário corrente. */
export async function toggleProductIgnored(
  userId: string,
  productName: string,
  currentlyIgnored: boolean,
): Promise<void> {
  const key = normalizeProductKey(productName);
  if (!key) return;
  if (currentlyIgnored) {
    await supabase
      .from("produtos_ignorados_destaques")
      .delete()
      .eq("user_id", userId)
      .eq("nome_normalizado", key);
  } else {
    await supabase.from("produtos_ignorados_destaques").insert({
      user_id: userId,
      nome_produto: productName,
      nome_normalizado: key,
    });
  }
}
