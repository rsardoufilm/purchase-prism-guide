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
  // jan=31, fev=28, mar=31, abr=30 → 4 parcelas (todas com clamp aplicado)
  assert(cycles.length === 4, `clamp gera 4 ciclos (got ${cycles.length})`);
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

// ============================================================
// G) ALERTA 5 DIAS — bordas exatas da janela
// ============================================================
{
  const start = new Date(2026, 0, 15);
  // exatamente 5 dias antes
  let today = new Date(2026, 6, 10);
  let next = nextDueDate(start, today, "mensal", 15);
  assert(daysBetween(today, next) === 5, "borda: 5 dias antes → alerta ligado");

  // 4 dias antes — ainda deve alertar (dentro da janela ≤5)
  today = new Date(2026, 6, 11);
  next = nextDueDate(start, today, "mensal", 15);
  assert(daysBetween(today, next) === 4, "borda: 4 dias antes → alerta ligado");

  // 6 dias antes — fora da janela
  today = new Date(2026, 6, 9);
  next = nextDueDate(start, today, "mensal", 15);
  assert(daysBetween(today, next) === 6, "borda: 6 dias antes → alerta desligado");

  // No dia do vencimento — diff 0, ainda dentro
  today = new Date(2026, 6, 15);
  next = nextDueDate(start, today, "mensal", 15);
  assert(daysBetween(today, next) === 0, "no dia do vencimento → diff 0");
}

// H) ALERTA — helper isWithinAlertWindow (regra ≤5 e ≥0)
{
  const isWithinAlertWindow = (start, today, freq, day, window = 5) => {
    const next = nextDueDate(start, today, freq, day);
    if (!next) return false;
    const d = daysBetween(today, next);
    return d >= 0 && d <= window;
  };
  const start = new Date(2026, 0, 15);
  assert(isWithinAlertWindow(start, new Date(2026, 6, 10), "mensal", 15), "janela: 5d dispara");
  assert(isWithinAlertWindow(start, new Date(2026, 6, 14), "mensal", 15), "janela: 1d dispara");
  assert(!isWithinAlertWindow(start, new Date(2026, 6, 8), "mensal", 15), "janela: 7d não dispara");
}

// I) RETROATIVOS — semanal (12 semanas atrás → 12 parcelas)
{
  const start = new Date(2026, 3, 1); // 01/abr
  const end = new Date(2026, 5, 24); // 24/jun → ~12 semanas
  const cycles = generateCycleDates(start, end, "semanal", null);
  assert(cycles.length === 13, `semanal retroativo: 13 (got ${cycles.length})`);
}

// J) RETROATIVOS — bimestral (6 meses = 3 parcelas)
{
  const start = new Date(2026, 0, 10); // jan
  const end = new Date(2026, 5, 10); // jun
  const cycles = generateCycleDates(start, end, "bimestral", 10);
  // jan, mar, mai → 3
  assert(cycles.length === 3, `bimestral retroativo: 3 (got ${cycles.length})`);
}

// K) RETROATIVOS — start = hoje ⇒ 1 parcela (a atual) ou 0? Regra: só passadas
{
  const today = new Date(2026, 6, 1);
  const start = new Date(today);
  const cycles = generateCycleDates(start, today, "mensal", 1);
  // start == end == hoje, apenas a data de hoje entra
  assert(cycles.length === 1, `start=hoje gera 1 ciclo (got ${cycles.length})`);
}

// L) RETROATIVOS — start = amanhã ⇒ 0 (nenhum passado)
{
  const today = new Date(2026, 6, 1);
  const tomorrow = new Date(2026, 6, 2);
  const cycles = generateCycleDates(tomorrow, today, "mensal", 2);
  assert(cycles.length === 0, "start futuro não gera retroativos");
}

// M) RETROATIVOS — trimestral 1 ano atrás → 4 parcelas
{
  const start = new Date(2025, 6, 1);
  const end = new Date(2026, 6, 1);
  const cycles = generateCycleDates(start, end, "trimestral", 1);
  // jul/25, out/25, jan/26, abr/26, jul/26 → 5
  assert(cycles.length === 5, `trimestral 1 ano: 5 (got ${cycles.length})`);
}

// N) RETROATIVOS + clamp — start 31/jan com frequência mensal, 4 meses atrás
{
  const start = new Date(2026, 0, 31);
  const end = new Date(2026, 4, 15);
  const cycles = generateCycleDates(start, end, "mensal", 31);
  // jan=31, fev=28, mar=31, abr=30 → 4 (mai=31 fica fora do end=15/mai)
  assert(cycles.length === 4, `clamp retroativo: 4 (got ${cycles.length})`);
  assert(toISODate(cycles[1]) === "2026-02-28", "fev clampeado retroativo");
  assert(toISODate(cycles[3]) === "2026-04-30", "abr clampeado retroativo");
}

if (failed > 0) {
  console.error(`\n${failed} teste(s) falharam.`);
  process.exit(1);
}
console.log("\n✅ Todos os testes do fluxo de Recorrentes passaram.");
