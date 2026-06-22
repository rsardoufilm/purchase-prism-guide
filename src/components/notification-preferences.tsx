import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Prefs {
  enabled_subscription: boolean;
  enabled_recurring: boolean;
  enabled_daily_summary: boolean;
  enabled_weekly_summary: boolean;
  enabled_health_alert: boolean;
  lead_days: 1 | 3 | 7;
  daily_summary_hour: number;
  quiet_start_hour: number | null;
  quiet_end_hour: number | null;
}

const DEFAULTS: Prefs = {
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

const TYPES: Array<{ key: keyof Prefs; label: string; desc: string }> = [
  {
    key: "enabled_subscription",
    label: "Assinaturas a vencer",
    desc: "Avisa quando uma assinatura está próxima do vencimento.",
  },
  {
    key: "enabled_recurring",
    label: "Contas recorrentes",
    desc: "Lembra de contas mensais próximas do dia de pagamento.",
  },
  {
    key: "enabled_daily_summary",
    label: "Resumo diário",
    desc: "Total do dia, gerado uma vez ao dia.",
  },
  {
    key: "enabled_weekly_summary",
    label: "Resumo semanal",
    desc: "Comparativo da semana, todas as segundas.",
  },
  {
    key: "enabled_health_alert",
    label: "Alerta de gorduras saturadas",
    desc: "Detecta consumo elevado de itens gordurosos.",
  },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function NotificationPreferences() {
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quietEnabled, setQuietEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setLoading(false);
        return;
      }
      setUserId(u.user.id);
      const { data } = await supabase
        .from("notification_preferences")
        .select(
          "enabled_subscription,enabled_recurring,enabled_daily_summary,enabled_weekly_summary,enabled_health_alert,lead_days,daily_summary_hour,quiet_start_hour,quiet_end_hour",
        )
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (data) {
        const merged = { ...DEFAULTS, ...data } as Prefs;
        setPrefs(merged);
        setQuietEnabled(merged.quiet_start_hour != null && merged.quiet_end_hour != null);
      }
      setLoading(false);
    })();
  }, []);

  const save = async (next: Prefs) => {
    if (!userId) return;
    setPrefs(next);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: userId, ...next });
      if (error) throw error;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggleQuiet = (v: boolean) => {
    setQuietEnabled(v);
    if (v)
      save({
        ...prefs,
        quiet_start_hour: prefs.quiet_start_hour ?? 22,
        quiet_end_hour: prefs.quiet_end_hour ?? 8,
      });
    else save({ ...prefs, quiet_start_hour: null, quiet_end_hour: null });
  };

  if (loading) {
    return (
      <section className="bg-card border border-border rounded-3xl p-5 mb-4">
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Carregando" />
      </section>
    );
  }

  return (
    <section
      className="bg-card border border-border rounded-3xl p-5 space-y-4 mb-4"
      aria-label="Preferências de notificação"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Notificações</h2>
        {saving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />}
      </div>

      <ul className="space-y-3">
        {TYPES.map((t) => (
          <li key={t.key} className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Label htmlFor={t.key} className="text-sm font-medium">
                {t.label}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
            </div>
            <Switch
              id={t.key}
              checked={prefs[t.key] as boolean}
              onCheckedChange={(v) => save({ ...prefs, [t.key]: v })}
              aria-label={t.label}
            />
          </li>
        ))}
      </ul>

      <div className="pt-2 border-t border-border space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Avisar com antecedência
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {[1, 3, 7].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => save({ ...prefs, lead_days: d as 1 | 3 | 7 })}
              className={`h-10 rounded-xl border text-sm font-medium transition-colors ${
                prefs.lead_days === d
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
              aria-pressed={prefs.lead_days === d}
            >
              {d} {d === 1 ? "dia" : "dias"}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Aplica-se a assinaturas e contas recorrentes.
        </p>
      </div>

      <div className="pt-2 border-t border-border space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="dailyHour" className="text-sm font-medium">
            Horário do resumo diário
          </Label>
          <span className="text-xs text-muted-foreground">Horário de Brasília</span>
        </div>
        <select
          id="dailyHour"
          value={prefs.daily_summary_hour}
          onChange={(e) => save({ ...prefs, daily_summary_hour: Number(e.target.value) })}
          className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}:00
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          O resumo semanal usa o mesmo horário (toda segunda).
        </p>
      </div>

      <div className="pt-2 border-t border-border space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Label htmlFor="quiet" className="text-sm font-medium">
              Período silencioso
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Nenhuma notificação é criada durante esta faixa.
            </p>
          </div>
          <Switch
            id="quiet"
            checked={quietEnabled}
            onCheckedChange={toggleQuiet}
            aria-label="Período silencioso"
          />
        </div>
        {quietEnabled && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                De
              </Label>
              <select
                value={prefs.quiet_start_hour ?? 22}
                onChange={(e) => save({ ...prefs, quiet_start_hour: Number(e.target.value) })}
                className="w-full h-10 mt-1 rounded-xl border border-border bg-background px-3 text-sm"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Até
              </Label>
              <select
                value={prefs.quiet_end_hour ?? 8}
                onChange={(e) => save({ ...prefs, quiet_end_hour: Number(e.target.value) })}
                className="w-full h-10 mt-1 rounded-xl border border-border bg-background px-3 text-sm"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
