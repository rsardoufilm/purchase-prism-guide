ALTER TABLE public.notification_preferences
  ADD COLUMN daily_summary_hour SMALLINT NOT NULL DEFAULT 20 CHECK (daily_summary_hour BETWEEN 0 AND 23),
  ADD COLUMN quiet_start_hour SMALLINT CHECK (quiet_start_hour BETWEEN 0 AND 23),
  ADD COLUMN quiet_end_hour SMALLINT CHECK (quiet_end_hour BETWEEN 0 AND 23);