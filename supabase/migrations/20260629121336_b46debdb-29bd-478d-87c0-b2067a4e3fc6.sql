
CREATE TABLE IF NOT EXISTS public.sugestoes_unificacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_a text NOT NULL,
  nome_b text NOT NULL,
  similaridade numeric NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aceita','rejeitada')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome_a, nome_b)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sugestoes_unificacao TO authenticated;
GRANT ALL ON public.sugestoes_unificacao TO service_role;

ALTER TABLE public.sugestoes_unificacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own suggestions select" ON public.sugestoes_unificacao
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own suggestions insert" ON public.sugestoes_unificacao
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own suggestions update" ON public.sugestoes_unificacao
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own suggestions delete" ON public.sugestoes_unificacao
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_sugestoes_unificacao_touch
  BEFORE UPDATE ON public.sugestoes_unificacao
  FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_sugestoes_unificacao_user_status
  ON public.sugestoes_unificacao(user_id, status);
