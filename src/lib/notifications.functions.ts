import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

// Lista de alimentos com alto teor de gordura saturada/trans
const FATTY_KEYWORDS = [
  "bacon","linguica","linguiça","salsicha","mortadela","presunto","calabresa",
  "manteiga","margarina","banha","creme de leite","requeijao","requeijão",
  "queijo amarelo","queijo cheddar","queijo prato","queijo mussarela","mussarela",
  "leite integral","nata","hamburguer","hambúrguer","nuggets","empanado",
  "batata frita","salgadinho","amendoim","chocolate","coxinha","kibe","pastel",
  "pizza congelada","lasanha congelada","fritura","torresmo","pururuca",
  "biscoito recheado","sorvete","bolacha recheada","croissant","creme vegetal"
];

interface Prefs {
  enabled_subscription: boolean;
  enabled_recurring: boolean;
  enabled_daily_summary: boolean;
  enabled_weekly_summary: boolean;
  enabled_health_alert: boolean;
  lead_days: number;
}

const DEFAULT_PREFS: Prefs = {
  enabled_subscription: true,
  enabled_recurring: true,
  enabled_daily_summary: true,
  enabled_weekly_summary: true,
  enabled_health_alert: true,
  lead_days: 3,
};

function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

/**
 * Núcleo isomórfico: gera notificações para 1 usuário usando o client passado.
 * Pode ser chamado tanto pelo serverFn autenticado quanto pelo cron (admin client).
 */
export async function runGenerateForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ created: number; items: Array<{ type: string; title: string }> }> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const created: Array<{ type: string; title: string }> = [];

  // Carrega prefs (ou usa default)
  const { data: prefRow } = await supabase
    .from("notification_preferences")
    .select("enabled_subscription,enabled_recurring,enabled_daily_summary,enabled_weekly_summary,enabled_health_alert,lead_days")
    .eq("user_id", userId)
    .maybeSingle();
  const prefs: Prefs = { ...DEFAULT_PREFS, ...(prefRow ?? {}) };

  const insert = async (row: {
    type: string; title: string; message: string;
    related_id?: string | null; dedupe_key: string;
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

  // 1) Assinaturas a vencer dentro de lead_days
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
      const dias = Math.max(0, Math.ceil((new Date(s.next_due_date as string).getTime() - today.getTime()) / 86400000));
      await insert({
        type: "subscription_due",
        title: `Assinatura ${s.name} vence em breve`,
        message: dias === 0
          ? `${s.name} vence hoje — R$ ${Number(s.amount).toFixed(2)}.`
          : `${s.name} vence em ${dias} dia${dias > 1 ? "s" : ""} — R$ ${Number(s.amount).toFixed(2)}.`,
        related_id: s.id,
        dedupe_key: `sub:${s.id}:${s.next_due_date}`,
      });
    }
  }

  // 2) Contas recorrentes próximas do dia do mês
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
          message: diff === 0
            ? `Vence hoje — R$ ${Number(b.amount).toFixed(2)}.`
            : `Vence em ${diff} dia${diff > 1 ? "s" : ""} — R$ ${Number(b.amount).toFixed(2)}.`,
          related_id: b.id,
          dedupe_key: `bill:${b.id}:${ym}`,
        });
      }
    }
  }

  // 3) Resumo diário
  if (prefs.enabled_daily_summary) {
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

  // 4) Resumo semanal (segunda)
  if (prefs.enabled_weekly_summary && today.getDay() === 1) {
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
    return runGenerateForUser(context.supabase, context.userId);
  });
