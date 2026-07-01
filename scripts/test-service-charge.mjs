#!/usr/bin/env node
/**
 * Regressão: taxa de serviço / gorjeta / couvert / "10% garçom"
 * nunca podem entrar em rankings de Consumo, Produtos ou Comparativos.
 */
import { isServiceCharge } from "../src/lib/service-charge.ts";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("✗", msg);
    failed++;
  } else {
    console.log("✓", msg);
  }
}

const positives = [
  "Taxa de Serviço",
  "TAXA SERVICO",
  "Serviço 10%",
  "SERVIÇO (10%)",
  "10% Garçom",
  "10% garcom",
  "Gorjeta",
  "Couvert Artístico",
  "Service Charge",
  "Tip",
  "Garçonagem",
];
for (const p of positives) assert(isServiceCharge(p), `bloqueia: "${p}"`);

const negatives = [
  "Coca-Cola 2L",
  "Picanha 500g",
  "Arroz Tipo 1 5kg",
  "Serviço de entrega paga", // "serviço de" isolado não é a linha 'taxa'
  "",
  null,
  undefined,
];
for (const n of negatives) assert(!isServiceCharge(n), `permite: "${n}"`);

if (failed > 0) {
  console.error(`\n${failed} teste(s) falharam.`);
  process.exit(1);
}
console.log("\n✅ Filtro de taxa de serviço OK.");
