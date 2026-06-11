export type PeriodKey =
  | "hoje"
  | "ontem"
  | "7d"
  | "15d"
  | "30d"
  | "este_mes"
  | "mes_passado"
  | "90d"
  | "este_ano"
  | "ultimo_ano"
  | "tudo";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7d": "7 dias",
  "15d": "15 dias",
  "30d": "30 dias",
  este_mes: "Este mês",
  mes_passado: "Mês passado",
  "90d": "90 dias",
  este_ano: "Este ano",
  ultimo_ano: "Último ano",
  tudo: "Tudo",
};

export const PRIMARY_PERIODS: PeriodKey[] = ["hoje", "7d", "30d", "este_mes"];
export const ALL_PERIODS: PeriodKey[] = [
  "hoje",
  "ontem",
  "7d",
  "15d",
  "30d",
  "este_mes",
  "mes_passado",
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

export function periodRange(key: PeriodKey): PeriodRange {
  const now = new Date();
  switch (key) {
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
      const days = { "7d": 7, "15d": 15, "30d": 30, "90d": 90 }[key];
      const s = new Date(now);
      s.setDate(s.getDate() - days);
      return { start: startOfDay(s), end: endOfDay(now) };
    }
    case "este_mes":
      return {
        start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: endOfDay(now),
      };
    case "mes_passado": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOfDay(s), end: endOfDay(e) };
    }
    case "este_ano":
      return {
        start: startOfDay(new Date(now.getFullYear(), 0, 1)),
        end: endOfDay(now),
      };
    case "ultimo_ano": {
      const s = new Date(now.getFullYear() - 1, 0, 1);
      const e = new Date(now.getFullYear() - 1, 11, 31);
      return { start: startOfDay(s), end: endOfDay(e) };
    }
    case "tudo":
      return { start: null, end: null };
  }
}
