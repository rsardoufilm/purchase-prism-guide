
ALTER TABLE public.recurring_expenses
  ADD COLUMN IF NOT EXISTS start_date date NOT NULL DEFAULT CURRENT_DATE;

CREATE TABLE IF NOT EXISTS public.recurring_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_id uuid NOT NULL REFERENCES public.recurring_expenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recurring_id, cycle_date)
);

CREATE INDEX IF NOT EXISTS recurring_cycles_recurring_idx
  ON public.recurring_cycles(recurring_id, cycle_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_cycles TO authenticated;
GRANT ALL ON public.recurring_cycles TO service_role;

ALTER TABLE public.recurring_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros do grupo veem ciclos"
  ON public.recurring_cycles FOR SELECT TO authenticated
  USING (public.mesmo_grupo(auth.uid(), user_id));

CREATE POLICY "Membros do grupo criam ciclos"
  ON public.recurring_cycles FOR INSERT TO authenticated
  WITH CHECK (public.mesmo_grupo(auth.uid(), user_id));

CREATE POLICY "Membros do grupo editam ciclos"
  ON public.recurring_cycles FOR UPDATE TO authenticated
  USING (public.mesmo_grupo(auth.uid(), user_id))
  WITH CHECK (public.mesmo_grupo(auth.uid(), user_id));

CREATE POLICY "Membros do grupo excluem ciclos"
  ON public.recurring_cycles FOR DELETE TO authenticated
  USING (public.mesmo_grupo(auth.uid(), user_id));
