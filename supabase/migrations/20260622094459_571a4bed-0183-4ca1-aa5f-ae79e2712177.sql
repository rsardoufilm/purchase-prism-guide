
CREATE TABLE public.user_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('subscription_due','recurring_due','daily_summary','weekly_summary','health_alert')),
  title text NOT NULL,
  message text NOT NULL,
  related_id uuid,
  read boolean NOT NULL DEFAULT false,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX user_notifications_dedupe_idx
  ON public.user_notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX user_notifications_user_created_idx
  ON public.user_notifications (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications"
  ON public.user_notifications
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
