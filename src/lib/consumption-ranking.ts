/**
 * Ranking de "Produtos mais consumidos".
 *
 * Critério de ordenação (importante — não é por R$):
 *  - Agrupamos por `normalized_name` (fallback: `raw_name`).
 *  - Separamos em duas listas independentes, sem misturar métricas:
 *      • byWeight → itens vendidos por peso (unidade "kg" ou "g", g convertido para kg).
 *                   Ordenados por quantidade acumulada em kg (desc).
 *      • byUnit   → itens vendidos por unidade discreta (un, pct, cx, etc.).
 *                   Ordenados pela contagem acumulada de unidades (desc).
 *  - O valor em R$ (`total`) é preservado apenas como dado secundário para exibição;
 *    ele NÃO influencia a ordenação.
 *  - Cada lista é truncada em `topN` (default 8).
 */

export interface ConsumptionItem {
  normalized_name: string | null;
  raw_name: string;
  quantity: number;
  unit: string | null;
  total_price: number;
}

export interface RankedEntry {
  total: number;
  qty: number;
  unit: string;
}

export interface ConsumptionRanking {
  byWeight: Array<[string, RankedEntry]>;
  byUnit: Array<[string, RankedEntry]>;
}

const WEIGHT_UNITS = new Set(["kg", "g", "kilo", "kilos"]);

export function rankConsumption(
  items: ConsumptionItem[],
  topN = 8,
): ConsumptionRanking {
  const weight = new Map<string, RankedEntry>();
  const unit = new Map<string, RankedEntry>();

  for (const it of items) {
    const key = it.normalized_name || it.raw_name;
    const rawUnit = (it.unit || "").toLowerCase().trim();
    const qty = Number(it.quantity) || 0;
    const total = Number(it.total_price) || 0;

    if (WEIGHT_UNITS.has(rawUnit)) {
      const qtyKg = rawUnit === "g" ? qty / 1000 : qty;
      const v = weight.get(key) ?? { total: 0, qty: 0, unit: "kg" };
      v.total += total;
      v.qty += qtyKg;
      weight.set(key, v);
    } else {
      const u = rawUnit || "un";
      const v = unit.get(key) ?? { total: 0, qty: 0, unit: u };
      v.total += total;
      v.qty += qty;
      unit.set(key, v);
    }
  }

  return {
    byWeight: [...weight.entries()]
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, topN),
    byUnit: [...unit.entries()]
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, topN),
  };
}

/**
 * Ranking de "Produtos mais caros por unidade base".
 *
 * Diferente de `rankConsumption` (que ordena por QUANTIDADE), este ranking
 * calcula o preço médio por unidade base (R$/kg ou R$/un) e ordena pelos
 * mais caros. Isso responde "qual produto está pesando mais no bolso por
 * unidade comprada", independente do volume comprado.
 *
 * Fórmula:
 *   unitPrice = Σ(total_price) ÷ Σ(quantidade_em_unidade_base)
 *
 * Onde quantidade_em_unidade_base:
 *   • Peso  → kg (g convertido: qty/1000)
 *   • Unid. → contagem discreta (un, pct, cx, etc.)
 *
 * Duas listas independentes para não misturar métricas incomparáveis
 * (R$/kg de arroz vs R$/un de escova de dente).
 */

export interface PricedEntry {
  unitPrice: number; // R$ por unidade base
  qty: number;       // quantidade acumulada (kg ou un)
  total: number;     // R$ acumulado
  unit: string;      // "kg" ou unidade discreta
}

export interface ExpensiveRanking {
  byWeight: Array<[string, PricedEntry]>;
  byUnit: Array<[string, PricedEntry]>;
}

export function rankMostExpensive(
  items: ConsumptionItem[],
  topN = 8,
): ExpensiveRanking {
  const weight = new Map<string, PricedEntry>();
  const unit = new Map<string, PricedEntry>();

  for (const it of items) {
    const key = it.normalized_name || it.raw_name;
    const rawUnit = (it.unit || "").toLowerCase().trim();
    const qty = Number(it.quantity) || 0;
    const total = Number(it.total_price) || 0;
    if (qty <= 0 || total <= 0) continue;

    if (WEIGHT_UNITS.has(rawUnit)) {
      const qtyKg = rawUnit === "g" ? qty / 1000 : qty;
      const v = weight.get(key) ?? { unitPrice: 0, qty: 0, total: 0, unit: "kg" };
      v.qty += qtyKg;
      v.total += total;
      v.unitPrice = v.qty > 0 ? v.total / v.qty : 0;
      weight.set(key, v);
    } else {
      const u = rawUnit || "un";
      const v = unit.get(key) ?? { unitPrice: 0, qty: 0, total: 0, unit: u };
      v.qty += qty;
      v.total += total;
      v.unitPrice = v.qty > 0 ? v.total / v.qty : 0;
      unit.set(key, v);
    }
  }

  return {
    byWeight: [...weight.entries()]
      .sort((a, b) => b[1].unitPrice - a[1].unitPrice)
      .slice(0, topN),
    byUnit: [...unit.entries()]
      .sort((a, b) => b[1].unitPrice - a[1].unitPrice)
      .slice(0, topN),
  };
}
