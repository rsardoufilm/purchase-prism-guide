
-- ===== Enum =====
CREATE TYPE public.papel_grupo AS ENUM ('admin', 'membro');

-- ===== Gerador de código de convite =====
CREATE OR REPLACE FUNCTION public.gerar_codigo_convite()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  codigo text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sem 0/O/1/I
  i int;
BEGIN
  LOOP
    codigo := '';
    FOR i IN 1..6 LOOP
      codigo := codigo || substr(chars, floor(random()*length(chars))::int + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.grupos_familiares WHERE codigo_convite = codigo);
  END LOOP;
  RETURN codigo;
END
$$;

-- ===== Tabela grupos_familiares =====
CREATE TABLE public.grupos_familiares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_grupo text NOT NULL,
  criado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo_convite text NOT NULL UNIQUE DEFAULT public.gerar_codigo_convite(),
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupos_familiares TO authenticated;
GRANT ALL ON public.grupos_familiares TO service_role;
ALTER TABLE public.grupos_familiares ENABLE ROW LEVEL SECURITY;

-- ===== Tabela membros_grupo =====
CREATE TABLE public.membros_grupo (
  grupo_id uuid NOT NULL REFERENCES public.grupos_familiares(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel public.papel_grupo NOT NULL DEFAULT 'membro',
  entrou_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (grupo_id, user_id)
);
-- regra: 1 grupo por usuário
CREATE UNIQUE INDEX membros_grupo_user_unico ON public.membros_grupo(user_id);
CREATE INDEX membros_grupo_grupo_idx ON public.membros_grupo(grupo_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.membros_grupo TO authenticated;
GRANT ALL ON public.membros_grupo TO service_role;
ALTER TABLE public.membros_grupo ENABLE ROW LEVEL SECURITY;

-- ===== Helpers SECURITY DEFINER (evitam recursão em RLS) =====
CREATE OR REPLACE FUNCTION public.grupo_do_usuario(_user uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT grupo_id FROM public.membros_grupo WHERE user_id = _user LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.mesmo_grupo(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _a = _b OR EXISTS (
    SELECT 1
    FROM public.membros_grupo m1
    JOIN public.membros_grupo m2 ON m1.grupo_id = m2.grupo_id
    WHERE m1.user_id = _a AND m2.user_id = _b
  )
$$;

-- ===== Políticas: grupos_familiares =====
CREATE POLICY "Ver grupo do usuário"
  ON public.grupos_familiares FOR SELECT TO authenticated
  USING (id = public.grupo_do_usuario(auth.uid()) OR criado_por = auth.uid());

CREATE POLICY "Criar grupo"
  ON public.grupos_familiares FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid());

CREATE POLICY "Admin atualiza grupo"
  ON public.grupos_familiares FOR UPDATE TO authenticated
  USING (criado_por = auth.uid())
  WITH CHECK (criado_por = auth.uid());

CREATE POLICY "Admin deleta grupo"
  ON public.grupos_familiares FOR DELETE TO authenticated
  USING (criado_por = auth.uid());

-- ===== Políticas: membros_grupo =====
CREATE POLICY "Ver membros do meu grupo"
  ON public.membros_grupo FOR SELECT TO authenticated
  USING (grupo_id = public.grupo_do_usuario(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Entrar em grupo"
  ON public.membros_grupo FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Sair do grupo"
  ON public.membros_grupo FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ===== Leitura compartilhada nas tabelas existentes =====
CREATE POLICY "Membros do grupo veem despesas"
  ON public.expenses FOR SELECT TO authenticated
  USING (public.mesmo_grupo(auth.uid(), user_id));

CREATE POLICY "Membros do grupo veem itens"
  ON public.expense_items FOR SELECT TO authenticated
  USING (public.mesmo_grupo(auth.uid(), user_id));

CREATE POLICY "Membros do grupo veem assinaturas"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (public.mesmo_grupo(auth.uid(), user_id));

CREATE POLICY "Membros do grupo veem recorrentes"
  ON public.recurring_expenses FOR SELECT TO authenticated
  USING (public.mesmo_grupo(auth.uid(), user_id));

-- Permite ler display_name de outros membros do grupo (para mostrar autor nos lançamentos)
CREATE POLICY "Membros do grupo veem perfis"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.mesmo_grupo(auth.uid(), id));

-- ===== Realtime =====
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.expense_items REPLICA IDENTITY FULL;
ALTER TABLE public.subscriptions REPLICA IDENTITY FULL;
ALTER TABLE public.recurring_expenses REPLICA IDENTITY FULL;
ALTER TABLE public.membros_grupo REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recurring_expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.membros_grupo;
