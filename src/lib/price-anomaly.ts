import { supabase } from "@/integrations/supabase/client";

/**
 * Variação máxima aceitável em relação à média histórica antes de alertar.
 * 2.0 = 200% acima da média (i.e. preço novo > 3x a média).
 */
export const PRICE_ANOMALY_THRESHOLD = 2.0;

export interface PriceAnomaly {
  index: number;
  productName: string;
  rawName: string;
  unitPrice: number;
  averagePrice: number;
  historyCount: number;
}

interface ItemForCheck {
  raw_name: string;
  normalized_name?: string | null;
  unit_price?: number | null;
  preco_confirmado_manualmente?: boolean;
}

/**
 * Carrega a média histórica de preço unitário (por produto normalizado) do usuário
 * e devolve as anomalias encontradas — itens cujo unit_price exceda
 * (1 + PRICE_ANOMALY_THRESHOLD) * média e que ainda não tenham confirmação manual.
 */
export async function detectPriceAnomalies(items: ItemForCheck[]): Promise<PriceAnomaly[]> {
  const candidates = items
    .map((it, index) => ({ it, index }))
    .filter(
      ({ it }) =>
        !it.preco_confirmado_manualmente &&
        it.normalized_name &&
        typeof it.unit_price === "number" &&
        it.unit_price > 0,
    );
  if (candidates.length === 0) return [];

  const names = Array.from(new Set(candidates.map(({ it }) => it.normalized_name as string)));

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("product_prices")
    .select("normalized_name,unit_price")
    .eq("user_id", userId)
    .in("normalized_name", names);
  if (error || !data) return [];

  const stats = new Map<string, { sum: number; count: number }>();
  for (const row of data) {
    const key = row.normalized_name;
    const price = Number(row.unit_price);
    if (!key || !Number.isFinite(price) || price <= 0) continue;
    const cur = stats.get(key) ?? { sum: 0, count: 0 };
    cur.sum += price;
    cur.count += 1;
    stats.set(key, cur);
  }

  const anomalies: PriceAnomaly[] = [];
  for (const { it, index } of candidates) {
    const key = it.normalized_name as string;
    const stat = stats.get(key);
    // Sem histórico → primeira compra → não alerta
    if (!stat || stat.count === 0) continue;
    const avg = stat.sum / stat.count;
    const price = Number(it.unit_price);
    if (price > avg * (1 + PRICE_ANOMALY_THRESHOLD)) {
      anomalies.push({
        index,
        productName: key,
        rawName: it.raw_name,
        unitPrice: price,
        averagePrice: avg,
        historyCount: stat.count,
      });
    }
  }
  return anomalies;
}
