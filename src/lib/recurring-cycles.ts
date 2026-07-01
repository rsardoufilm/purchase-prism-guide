// Helpers para cálculo de ciclos de contas recorrentes.

export type Frequency = "semanal" | "mensal" | "bimestral" | "trimestral" | "semestral" | "anual";

const MONTHS_BY_FREQ: Record<Exclude<Frequency, "semanal">, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/** Ajusta o dia p/ não estourar o mês (ex.: dia 31 em fevereiro). */
function clampDay(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

/**
 * Gera todas as datas de ciclo entre startDate e endDate (inclusive),
 * respeitando a frequência e o dia de vencimento.
 */
export function generateCycleDates(
  startDate: Date,
  endDate: Date,
  frequency: Frequency,
  dueDay: number | null,
): Date[] {
  if (endDate < startDate) return [];
  const dates: Date[] = [];

  if (frequency === "semanal") {
    const cur = new Date(startDate);
    while (cur <= endDate) {
      dates.push(new Date(cur));
      cur.setDate(cur.getDate() + 7);
    }
    return dates;
  }

  const step = MONTHS_BY_FREQ[frequency];
  const day = dueDay ?? startDate.getDate();
  let y = startDate.getFullYear();
  let m = startDate.getMonth();
  // Se o dia de vencimento neste mês já passou em relação ao start, mantém neste mês
  let cur = clampDay(y, m, day);
  if (cur < startDate) {
    m += step;
    cur = clampDay(y, m, day);
  }
  while (cur <= endDate) {
    dates.push(cur);
    m += step;
    cur = clampDay(y, m, day);
  }
  return dates;
}

/** Próxima data de vencimento a partir de "from" (>= from). */
export function nextDueDate(
  startDate: Date,
  from: Date,
  frequency: Frequency,
  dueDay: number | null,
): Date | null {
  // Gera dos "from" (menos margem) até 400 dias depois — cobre até anual.
  const horizon = new Date(from);
  horizon.setFullYear(horizon.getFullYear() + 1);
  horizon.setDate(horizon.getDate() + 30);
  const anchor = startDate < from ? startDate : from;
  const cycles = generateCycleDates(anchor, horizon, frequency, dueDay);
  return cycles.find((d) => d >= startOfDay(from)) ?? null;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86400000);
}

/** Formata data como YYYY-MM-DD (para colunas `date` do Postgres). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Rótulo humano do ciclo (ex.: "nov/2026"). */
export function cycleLabel(d: Date): string {
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");
}
