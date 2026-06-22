export interface SubscriptionRow {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  next_due_date: string | null;
}

export interface SubscriptionOccurrence {
  subId: string;
  name: string;
  amount: number;
  date: Date;
}

export const SUBSCRIPTION_HORIZON_MONTHS = 8;

const FREQ_MONTHS: Record<string, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export function addMonths(d: Date, n: number) {
  const out = new Date(d);
  const day = out.getDate();
  out.setMonth(out.getMonth() + n);
  if (out.getDate() < day) out.setDate(0);
  return out;
}

export function parseDateLocal(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function projectSubscriptionOccurrences(
  subs: SubscriptionRow[],
  horizonMonths = SUBSCRIPTION_HORIZON_MONTHS,
): SubscriptionOccurrence[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = addMonths(today, horizonMonths);
  const out: SubscriptionOccurrence[] = [];
  for (const s of subs) {
    if (!s.next_due_date) continue;
    const step = FREQ_MONTHS[s.frequency] ?? 1;
    let d = parseDateLocal(s.next_due_date);
    while (d < today) d = addMonths(d, step);
    while (d <= horizon) {
      out.push({ subId: s.id, name: s.name, amount: Number(s.amount), date: new Date(d) });
      d = addMonths(d, step);
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}
