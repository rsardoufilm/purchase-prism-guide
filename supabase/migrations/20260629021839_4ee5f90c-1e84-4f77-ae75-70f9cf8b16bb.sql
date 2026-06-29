-- 1) Tabela: dicionario_usuario (aprendizado pessoal)
CREATE TABLE public.dicionario_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  termo_original text NOT NULL,
  termo_normalizado text NOT NULL,
  categoria_corrigida text NOT NULL,
  nome_corrigido text,
  confirmacoes integer NOT NULL DEFAULT 1,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dicionario_usuario_uq UNIQUE (user_id, termo_normalizado, categoria_corrigida)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dicionario_usuario TO authenticated;
GRANT ALL ON public.dicionario_usuario TO service_role;

ALTER TABLE public.dicionario_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads own dictionary"
  ON public.dicionario_usuario FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "owner inserts own dictionary"
  ON public.dicionario_usuario FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner updates own dictionary"
  ON public.dicionario_usuario FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner deletes own dictionary"
  ON public.dicionario_usuario FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX dicionario_usuario_user_norm_idx
  ON public.dicionario_usuario (user_id, termo_normalizado);

-- 2) Tabela: dicionario_global (aprendizado coletivo, com aprovação manual)
CREATE TABLE public.dicionario_global (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termo_original text NOT NULL,
  termo_normalizado text NOT NULL,
  categoria_sugerida text NOT NULL,
  nome_sugerido text,
  votos integer NOT NULL DEFAULT 1,
  aprovado boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dicionario_global_uq UNIQUE (termo_normalizado, categoria_sugerida)
);

GRANT SELECT ON public.dicionario_global TO authenticated;
GRANT ALL ON public.dicionario_global TO service_role;

ALTER TABLE public.dicionario_global ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode LER apenas registros aprovados.
CREATE POLICY "authenticated reads approved global"
  ON public.dicionario_global FOR SELECT TO authenticated
  USING (aprovado = true);

CREATE INDEX dicionario_global_norm_aprovado_idx
  ON public.dicionario_global (termo_normalizado) WHERE aprovado = true;

-- 3) Trigger: manter atualizado_em em ambas as tabelas
CREATE OR REPLACE FUNCTION public.touch_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER dicionario_usuario_touch
  BEFORE UPDATE ON public.dicionario_usuario
  FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

CREATE TRIGGER dicionario_global_touch
  BEFORE UPDATE ON public.dicionario_global
  FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

-- 4) Trigger: promoção automática para o dicionário global ao atingir 5 usuários distintos
CREATE OR REPLACE FUNCTION public.promover_dicionario_global()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_distintos integer;
  v_qualquer_termo text;
BEGIN
  -- Conta quantos usuários distintos têm a mesma (termo_normalizado, categoria).
  SELECT COUNT(DISTINCT user_id)
    INTO v_distintos
    FROM public.dicionario_usuario
   WHERE termo_normalizado = NEW.termo_normalizado
     AND categoria_corrigida = NEW.categoria_corrigida;

  IF v_distintos >= 5 THEN
    SELECT termo_original
      INTO v_qualquer_termo
      FROM public.dicionario_usuario
     WHERE termo_normalizado = NEW.termo_normalizado
       AND categoria_corrigida = NEW.categoria_corrigida
     ORDER BY criado_em ASC
     LIMIT 1;

    INSERT INTO public.dicionario_global (
      termo_original, termo_normalizado, categoria_sugerida, votos, aprovado
    ) VALUES (
      COALESCE(v_qualquer_termo, NEW.termo_original),
      NEW.termo_normalizado,
      NEW.categoria_corrigida,
      v_distintos,
      false
    )
    ON CONFLICT (termo_normalizado, categoria_sugerida)
    DO UPDATE SET votos = EXCLUDED.votos, atualizado_em = now();
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER dicionario_usuario_promover
  AFTER INSERT OR UPDATE OF categoria_corrigida, confirmacoes
  ON public.dicionario_usuario
  FOR EACH ROW EXECUTE FUNCTION public.promover_dicionario_global();