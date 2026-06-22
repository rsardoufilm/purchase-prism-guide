export type StaticPeriodKey =
  | "hoje"
  | "ontem"
  | "7d"
  | "15d"
  | "30d"
  | "este_mes"
  | "90d"
  | "este_ano"
  | "ultimo_ano"
  | "tudo";

/** Período: chave estática OU `month:YYYY-MM` para um mês específico. */
export type PeriodKey = StaticPeriodKey | `month:${string}`;

export const PERIOD_LABELS: Record<StaticPeriodKey, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7d": "7 dias",
  "15d": "15 dias",
  "30d": "30 dias",
  este_mes: "Este mês",
  "90d": "90 dias",
  este_ano: "Este ano",
  ultimo_ano: "Último ano",
  tudo: "Tudo",
};

export const PRIMARY_PERIODS: StaticPeriodKey[] = ["hoje", "7d", "30d", "este_mes"];
export const ALL_PERIODS: StaticPeriodKey[] = [
  "hoje",
  "ontem",
  "7d",
  "15d",
  "30d",
  "este_mes",
  "90d",
  "este_ano",
  "ultimo_ano",
  "tudo",
];

export interface PeriodRange {
  start: Date | null;
  end: Date | null;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const MONTH_NAMES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** "2025-05" → "Maio 2025" (ou "Maio" se for ano corrente). */
export function monthLabel(ym: string): string {
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return ym;
  const name = MONTH_NAMES_PT[m - 1];
  const currentYear = new Date().getFullYear();
  return y === currentYear ? name : `${name} ${y}`;
}

export function periodLabel(key: PeriodKey): string {
  if (key.startsWith("month:")) return monthLabel(key.slice(6));
  return PERIOD_LABELS[key as StaticPeriodKey] ?? key;
}

export function periodRange(key: PeriodKey): PeriodRange {
  const now = new Date();

  if (key.startsWith("month:")) {
    const [yStr, mStr] = key.slice(6).split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (Number.isFinite(y) && Number.isFinite(m)) {
      const s = new Date(y, m - 1, 1);
      const e = new Date(y, m, 0);
      return { start: startOfDay(s), end: endOfDay(e) };
    }
    return { start: null, end: null };
  }

  switch (key as StaticPeriodKey) {
    case "hoje":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "ontem": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "7d":
    case "15d":
    case "30d":
    case "90d": {
      const days = { "7d": 7, "15d": 15, "30d": 30, "90d": 90 }[
        key as "7d" | "15d" | "30d" | "90d"
      ];
      const s = new Date(now);
      s.setDate(s.getDate() - days);
      return { start: startOfDay(s), end: endOfDay(now) };
    }
    case "este_mes":
      return {
        start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: endOfDay(now),
      };
    case "este_ano":
      return { start: startOfDay(new Date(now.getFullYear(), 0, 1)), end: endOfDay(now) };
    case "ultimo_ano": {
      const s = new Date(now.getFullYear() - 1, 0, 1);
      const e = new Date(now.getFullYear() - 1, 11, 31);
      return { start: startOfDay(s), end: endOfDay(e) };
    }
    case "tudo":
      return { start: null, end: null };
  }
}
