import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

// Lista de alimentos com alto teor de gordura saturada/trans
const FATTY_KEYWORDS = [
  "bacon",
  "linguica",
  "linguiça",
  "salsicha",
  "mortadela",
  "presunto",
  "calabresa",
  "manteiga",
  "margarina",
  "banha",
  "creme de leite",
  "requeijao",
  "requeijão",
  "queijo amarelo",
  "queijo cheddar",
  "queijo prato",
  "queijo mussarela",
  "mussarela",
  "leite integral",
  "nata",
  "hamburguer",
  "hambúrguer",
  "nuggets",
  "empanado",
  "batata frita",
  "salgadinho",
  "amendoim",
  "chocolate",
  "coxinha",
  "kibe",
  "pastel",
  "pizza congelada",
  "lasanha congelada",
  "fritura",
  "torresmo",
  "pururuca",
  "biscoito recheado",
  "sorvete",
  "bolacha recheada",
  "croissant",
  "creme vegetal",
];

interface Prefs {
  enabled_subscription: boolean;
  enabled_recurring: boolean;
  enabled_daily_summary: boolean;
  enabled_weekly_summary: boolean;
  enabled_health_alert: boolean;
  lead_days: number;
  daily_summary_hour: number;
  quiet_start_hour: number | null;
  quiet_end_hour: number | null;
}

const DEFAULT_PREFS: Prefs = {
  enabled_subscription: true,
  enabled_recurring: true,
  enabled_daily_summary: true,
  enabled_weekly_summary: true,
  enabled_health_alert: true,
  lead_days: 3,
  daily_summary_hour: 20,
  quiet_start_hour: null,
  quiet_end_hour: null,
};

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Hora atual em America/Sao_Paulo (0-23). */
function localHour(d: Date): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    hour12: false,
  }).format(d);
  // Intl às vezes devolve "24" à meia-noite; normaliza.
  const n = Number(h);
  return Number.isFinite(n) ? n % 24 : 0;
}

/** Dia da semana 0-6 em America/Sao_Paulo (0=domingo). */
function localDay(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(d);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[parts] ?? 0;
}

/** true se `hour` está dentro de [start, end), tratando wrap (ex.: 22→8). */
function inQuietWindow(hour: number, start: number | null, end: number | null): boolean {
  if (start == null || end == null || start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end; // janela atravessa meia-noite
}

/**
 * Núcleo isomórfico: gera notificações para 1 usuário usando o client passado.
 * Pode ser chamado pelo serverFn autenticado ou pelo cron (admin client).
 */
export async function runGenerateForUser(
  supabase: SupabaseClient,
  userId: string,
  opts: { respectSchedule?: boolean } = {},
): Promise<{ created: number; items: Array<{ type: string; title: string }>; skipped?: string }> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const created: Array<{ type: string; title: string }> = [];

  const { data: prefRow } = await supabase
    .from("notification_preferences")
    .select(
      "enabled_subscription,enabled_recurring,enabled_daily_summary,enabled_weekly_summary,enabled_health_alert,lead_days,daily_summary_hour,quiet_start_hour,quiet_end_hour",
    )
    .eq("user_id", userId)
    .maybeSingle();
  const prefs: Prefs = { ...DEFAULT_PREFS, ...(prefRow ?? {}) };

  // Quiet hours: usadas só pelo cron (respectSchedule). No serverFn (abertura do app)
  // o usuário pediu o reload — não silenciamos.
  const hour = localHour(today);
  if (opts.respectSchedule && inQuietWindow(hour, prefs.quiet_start_hour, prefs.quiet_end_hour)) {
    return { created: 0, items: [], skipped: "quiet_hours" };
  }

  const insert = async (row: {
    type: string;
    title: string;
    message: string;
    related_id?: string | null;
    dedupe_key: string;
  }) => {
    const { error } = await supabase.from("user_notifications").insert({
      user_id: userId,
      type: row.type,
      title: row.title,
      message: row.message,
      related_id: row.related_id ?? null,
      dedupe_key: row.dedupe_key,
    });
    if (!error) created.push({ type: row.type, title: row.title });
  };

  // 1) Assinaturas
  if (prefs.enabled_subscription) {
    const limit = addDays(today, prefs.lead_days).toISOString().slice(0, 10);
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("id,name,amount,next_due_date,active,user_id")
      .eq("user_id", userId)
      .eq("active", true)
      .not("next_due_date", "is", null)
      .lte("next_due_date", limit)
      .gte("next_due_date", todayStr);
    for (const s of subs ?? []) {
      const dias = Math.max(
        0,
        Math.ceil((new Date(s.next_due_date as string).getTime() - today.getTime()) / 86400000),
      );
      await insert({
        type: "subscription_due",
        title: `Assinatura ${s.name} vence em breve`,
        message:
          dias === 0
            ? `${s.name} vence hoje — R$ ${Number(s.amount).toFixed(2)}.`
            : `${s.name} vence em ${dias} dia${dias > 1 ? "s" : ""} — R$ ${Number(s.amount).toFixed(2)}.`,
        related_id: s.id,
        dedupe_key: `sub:${s.id}:${s.next_due_date}`,
      });
    }
  }

  // 2) Contas recorrentes
  if (prefs.enabled_recurring) {
    const { data: bills } = await supabase
      .from("recurring_expenses")
      .select("id,name,amount,due_day,active,user_id")
      .eq("user_id", userId)
      .eq("active", true)
      .not("due_day", "is", null);
    const currentDay = today.getDate();
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    for (const b of bills ?? []) {
      const diff = (b.due_day as number) - currentDay;
      if (diff >= 0 && diff <= prefs.lead_days) {
        await insert({
          type: "recurring_due",
          title: `Conta ${b.name} próxima do vencimento`,
          message:
            diff === 0
              ? `Vence hoje — R$ ${Number(b.amount).toFixed(2)}.`
              : `Vence em ${diff} dia${diff > 1 ? "s" : ""} — R$ ${Number(b.amount).toFixed(2)}.`,
          related_id: b.id,
          dedupe_key: `bill:${b.id}:${ym}`,
        });
      }
    }
  }

  // 3) Resumo diário — no cron, só dispara na hora escolhida pelo usuário.
  // Quando chamado pelo app (respectSchedule=false), sempre tenta — o dedupe evita duplicatas.
  const dailyHourMatches = !opts.respectSchedule || hour === prefs.daily_summary_hour;
  if (prefs.enabled_daily_summary && dailyHourMatches) {
    const { data: todayExp } = await supabase
      .from("expenses")
      .select("total_amount,user_id")
      .eq("user_id", userId)
      .eq("expense_date", todayStr);
    const totalDia = (todayExp ?? []).reduce((a, e) => a + Number(e.total_amount), 0);
    if (totalDia > 0) {
      await insert({
        type: "daily_summary",
        title: "Resumo do dia",
        message: `Você gastou R$ ${totalDia.toFixed(2)} hoje em ${todayExp?.length ?? 0} despesa(s).`,
        dedupe_key: `daily:${todayStr}`,
      });
    }
  }

  // 4) Resumo semanal — segunda-feira na hora escolhida (ou sempre se app)
  const isMonday = localDay(today) === 1;
  if (prefs.enabled_weekly_summary && isMonday && dailyHourMatches) {
    const start = addDays(today, -7).toISOString().slice(0, 10);
    const { data: weekExp } = await supabase
      .from("expenses")
      .select("total_amount,user_id")
      .eq("user_id", userId)
      .gte("expense_date", start)
      .lt("expense_date", todayStr);
    const totalSem = (weekExp ?? []).reduce((a, e) => a + Number(e.total_amount), 0);
    if (totalSem > 0) {
      await insert({
        type: "weekly_summary",
        title: "Resumo da semana",
        message: `Semana passada: R$ ${totalSem.toFixed(2)} em ${weekExp?.length ?? 0} despesa(s).`,
        dedupe_key: `weekly:${start}`,
      });
    }
  }

  // 5) Alerta de gorduras (últimos 7 dias)
  if (prefs.enabled_health_alert) {
    const since = addDays(today, -7).toISOString();
    const { data: items } = await supabase
      .from("expense_items")
      .select("id,normalized_name,raw_name,total_price,created_at,user_id")
      .eq("user_id", userId)
      .gte("created_at", since);
    const matches = (items ?? []).filter((it) => {
      const n = `${it.normalized_name ?? ""} ${it.raw_name ?? ""}`.toLowerCase();
      return FATTY_KEYWORDS.some((k) => n.includes(k));
    });
    if (matches.length >= 3) {
      const totalGord = matches.reduce((a, it) => a + Number(it.total_price ?? 0), 0);
      const wkKey = `${today.getFullYear()}-W${Math.ceil(today.getDate() / 7)}`;
      await insert({
        type: "health_alert",
        title: "Atenção ao consumo de gorduras saturadas",
        message: `Identificamos ${matches.length} itens com alto teor de gordura saturada nos últimos 7 dias (R$ ${totalGord.toFixed(2)}). Considere alternativas mais saudáveis.`,
        dedupe_key: `health:${wkKey}`,
      });
    }
  }

  return { created: created.length, items: created };
}

export const generateNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return runGenerateForUser(context.supabase, context.userId, { respectSchedule: false });
  });
