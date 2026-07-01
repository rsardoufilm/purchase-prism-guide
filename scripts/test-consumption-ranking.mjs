#!/usr/bin/env node
/**
 * Regressão da ordenação em Consumo → "Produtos mais consumidos".
 * Garante que:
 *  1. Peso e unidade ficam em listas separadas.
 *  2. Ordenação é por QUANTIDADE FÍSICA, nunca por R$.
 *  3. Gramas são convertidos para kg antes de acumular.
 *  4. Mesmo produto com preço muito maior mas menor volume fica ABAIXO.
 */
import { rankConsumption, rankMostExpensive } from "../src/lib/consumption-ranking.ts";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("✗", msg);
    failed++;
  } else {
    console.log("✓", msg);
  }
}

// 1) Separação peso × unidade
{
  const r = rankConsumption([
    { normalized_name: "Arroz", raw_name: "Arroz", quantity: 5, unit: "kg", total_price: 30 },
    { normalized_name: "Coca", raw_name: "Coca", quantity: 3, unit: "un", total_price: 20 },
  ]);
  assert(r.byWeight.length === 1 && r.byWeight[0][0] === "Arroz", "peso isolado");
  assert(r.byUnit.length === 1 && r.byUnit[0][0] === "Coca", "unidade isolada");
}

// 2) Ordenação por quantidade, não por R$
{
  const r = rankConsumption([
    // Caro mas pouca unidade
    { normalized_name: "Whisky", raw_name: "Whisky", quantity: 1, unit: "un", total_price: 500 },
    // Barato mas muitas unidades
    { normalized_name: "Iogurte", raw_name: "Iogurte", quantity: 20, unit: "un", total_price: 60 },
  ]);
  assert(r.byUnit[0][0] === "Iogurte", "quantidade vence preço na ordenação por unidade");
  assert(r.byUnit[1][0] === "Whisky", "produto caro/pouco fica abaixo");
}

// 3) Conversão g → kg + agregação
{
  const r = rankConsumption([
    { normalized_name: "Café", raw_name: "Café", quantity: 500, unit: "g", total_price: 25 },
    { normalized_name: "Café", raw_name: "Café", quantity: 0.5, unit: "kg", total_price: 25 },
    { normalized_name: "Feijão", raw_name: "Feijão", quantity: 2, unit: "kg", total_price: 20 },
  ]);
  const cafe = r.byWeight.find(([k]) => k === "Café");
  assert(!!cafe && Math.abs(cafe[1].qty - 1) < 1e-9, "500g + 0.5kg = 1kg acumulado");
  assert(r.byWeight[0][0] === "Feijão", "Feijão (2kg) vence Café (1kg) mesmo com R$ igual");
}

// 4) Ordenação por peso, não por R$
{
  const r = rankConsumption([
    { normalized_name: "Picanha", raw_name: "Picanha", quantity: 0.5, unit: "kg", total_price: 90 },
    { normalized_name: "Batata", raw_name: "Batata", quantity: 10, unit: "kg", total_price: 40 },
  ]);
  assert(r.byWeight[0][0] === "Batata", "peso vence preço na ordenação por peso");
}

// 5) topN respeitado
{
  const many = Array.from({ length: 20 }, (_, i) => ({
    normalized_name: `P${i}`,
    raw_name: `P${i}`,
    quantity: i + 1,
    unit: "un",
    total_price: 1,
  }));
  const r = rankConsumption(many, 8);
  assert(r.byUnit.length === 8, "topN=8 aplicado");
  assert(r.byUnit[0][0] === "P19", "maior quantidade primeiro");
}

// 6) Mais caros: ordena por R$/unidade base, não por total nem por quantidade
{
  const r = rankMostExpensive([
    { normalized_name: "Picanha", raw_name: "Picanha", quantity: 2, unit: "kg", total_price: 180 }, // 90/kg
    { normalized_name: "Arroz", raw_name: "Arroz", quantity: 10, unit: "kg", total_price: 50 },     // 5/kg
    { normalized_name: "Whisky", raw_name: "Whisky", quantity: 1, unit: "un", total_price: 500 },   // 500/un
    { normalized_name: "Iogurte", raw_name: "Iogurte", quantity: 20, unit: "un", total_price: 60 }, // 3/un
  ]);
  assert(r.byWeight[0][0] === "Picanha", "mais caro por peso: Picanha (R$90/kg) > Arroz (R$5/kg)");
  assert(Math.abs(r.byWeight[0][1].unitPrice - 90) < 1e-9, "R$/kg calculado corretamente");
  assert(r.byUnit[0][0] === "Whisky", "mais caro por unidade: Whisky (R$500/un) > Iogurte (R$3/un)");
  assert(Math.abs(r.byUnit[0][1].unitPrice - 500) < 1e-9, "R$/un calculado corretamente");
}

// 7) Mais caros: agrega múltiplas compras antes de calcular preço médio
{
  const r = rankMostExpensive([
    { normalized_name: "Café", raw_name: "Café", quantity: 500, unit: "g", total_price: 30 },   // 0.5kg / R$30
    { normalized_name: "Café", raw_name: "Café", quantity: 0.5, unit: "kg", total_price: 20 },  // +0.5kg / +R$20
  ]);
  // Total: 1kg / R$50 → R$50/kg
  const cafe = r.byWeight.find(([k]) => k === "Café");
  assert(!!cafe && Math.abs(cafe[1].unitPrice - 50) < 1e-9, "média ponderada: (30+20)/(0.5+0.5) = R$50/kg");
}


if (failed > 0) {
  console.error(`\n${failed} teste(s) falharam`);
  process.exit(1);
}
console.log("\nTodos os testes de ordenação passaram.");
