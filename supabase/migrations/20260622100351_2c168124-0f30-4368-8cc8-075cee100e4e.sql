CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled_subscription BOOLEAN NOT NULL DEFAULT true,
  enabled_recurring BOOLEAN NOT NULL DEFAULT true,
  enabled_daily_summary BOOLEAN NOT NULL DEFAULT true,
  enabled_weekly_summary BOOLEAN NOT NULL DEFAULT true,
  enabled_health_alert BOOLEAN NOT NULL DEFAULT true,
  lead_days SMALLINT NOT NULL DEFAULT 3 CHECK (lead_days IN (1,3,7)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON public.notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER notif_prefs_set_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();