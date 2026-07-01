#!/usr/bin/env node
/**
 * Regressão do fluxo de contas Recorrentes:
 *  A) Janela de 5 dias antes do vencimento (alerta).
 *  B) Detecção de parcelas retroativas ao cadastrar com data passada.
 *  C) Clamp de dia (ex.: dia 31 em fevereiro).
 *  D) Frequência semanal e mensal.
 */
import {
  generateCycleDates,
  nextDueDate,
  daysBetween,
  toISODate,
  startOfDay,
} from "../src/lib/recurring-cycles.ts";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("✗", msg);
    failed++;
  } else {
    console.log("✓", msg);
  }
}

// A) Alerta 5 dias antes — mensal, due_day 15
{
  const start = new Date(2026, 0, 15); // 15/jan/2026
  const today = new Date(2026, 6, 10); // 10/jul/2026
  const next = nextDueDate(start, today, "mensal", 15);
  assert(next !== null, "próximo vencimento calculado");
  const diff = daysBetween(today, next);
  assert(diff === 5, `diff = ${diff}, esperado 5 (janela de alerta)`);
}

// A2) Fora da janela de 5 dias
{
  const start = new Date(2026, 0, 15);
  const today = new Date(2026, 6, 1); // 01/jul — 14 dias antes
  const next = nextDueDate(start, today, "mensal", 15);
  const diff = daysBetween(today, next);
  assert(diff > 5, `fora da janela (diff=${diff})`);
}

// B) Retroativos — start há 3 meses, mensal
{
  const start = new Date(2026, 3, 10); // abr/2026
  const end = new Date(2026, 6, 1); // 01/jul/2026
  const cycles = generateCycleDates(start, end, "mensal", 10);
  // 10/abr, 10/mai, 10/jun => 3 parcelas
  assert(cycles.length === 3, `retroativos: 3 parcelas (got ${cycles.length})`);
  assert(toISODate(cycles[0]) === "2026-04-10", "1ª parcela em 10/abr");
  assert(toISODate(cycles[2]) === "2026-06-10", "3ª parcela em 10/jun");
}

// C) Clamp — due_day 31 em fevereiro
{
  const start = new Date(2026, 0, 31);
  const end = new Date(2026, 3, 30);
  const cycles = generateCycleDates(start, end, "mensal", 31);
  // jan=31, fev=28, mar=31 → aceitar 3 parcelas com clamp
  assert(cycles.length === 3, `clamp gera 3 ciclos (got ${cycles.length})`);
  assert(toISODate(cycles[1]) === "2026-02-28", `fev clampeado (got ${toISODate(cycles[1])})`);
}

// D) Semanal
{
  const start = new Date(2026, 0, 1);
  const end = new Date(2026, 0, 22);
  const cycles = generateCycleDates(start, end, "semanal", null);
  assert(cycles.length === 4, `semanal: 4 ocorrências (got ${cycles.length})`);
}

// E) Nada retroativo quando start é futuro
{
  const start = new Date(2027, 0, 1);
  const end = new Date(2026, 6, 1);
  const cycles = generateCycleDates(start, end, "mensal", 1);
  assert(cycles.length === 0, "start futuro não gera retroativos");
}

// F) startOfDay zera horas
{
  const d = new Date(2026, 5, 15, 23, 59, 59);
  const s = startOfDay(d);
  assert(s.getHours() === 0 && s.getMinutes() === 0, "startOfDay zera horas");
}

if (failed > 0) {
  console.error(`\n${failed} teste(s) falharam.`);
  process.exit(1);
}
console.log("\n✅ Todos os testes do fluxo de Recorrentes passaram.");
