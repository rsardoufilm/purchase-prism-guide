
-- ========== categorias_ignoradas_destaques ==========
CREATE TABLE public.categorias_ignoradas_destaques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, categoria)
);
CREATE INDEX idx_cat_ign_user ON public.categorias_ignoradas_destaques(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_ignoradas_destaques TO authenticated;
GRANT ALL ON public.categorias_ignoradas_destaques TO service_role;

ALTER TABLE public.categorias_ignoradas_destaques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner select cat ign" ON public.categorias_ignoradas_destaques
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner insert cat ign" ON public.categorias_ignoradas_destaques
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner delete cat ign" ON public.categorias_ignoradas_destaques
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ========== produtos_ignorados_destaques ==========
CREATE TABLE public.produtos_ignorados_destaques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_produto text NOT NULL,
  nome_normalizado text NOT NULL,
  motivo text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome_normalizado)
);
CREATE INDEX idx_prod_ign_user ON public.produtos_ignorados_destaques(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos_ignorados_destaques TO authenticated;
GRANT ALL ON public.produtos_ignorados_destaques TO service_role;

ALTER TABLE public.produtos_ignorados_destaques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner select prod ign" ON public.produtos_ignorados_destaques
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner insert prod ign" ON public.produtos_ignorados_destaques
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner delete prod ign" ON public.produtos_ignorados_destaques
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ========== Seeds ==========
INSERT INTO public.categorias_ignoradas_destaques (user_id, categoria)
SELECT id, 'Embalagens' FROM auth.users
ON CONFLICT (user_id, categoria) DO NOTHING;

INSERT INTO public.produtos_ignorados_destaques (user_id, nome_produto, nome_normalizado)
SELECT id, 'Sacola Plástica', 'sacola plastica' FROM auth.users
ON CONFLICT (user_id, nome_normalizado) DO NOTHING;
