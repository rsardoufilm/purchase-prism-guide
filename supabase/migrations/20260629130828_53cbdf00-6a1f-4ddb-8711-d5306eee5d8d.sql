
-- Auditoria de tentativas de entrada em grupos + proteção contra brute force.
CREATE TABLE IF NOT EXISTS public.tentativas_convite (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo_tentado TEXT NOT NULL,
  sucesso BOOLEAN NOT NULL DEFAULT false,
  motivo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tentativas_user_time
  ON public.tentativas_convite (user_id, criado_em DESC);

GRANT SELECT, INSERT ON public.tentativas_convite TO authenticated;
GRANT ALL ON public.tentativas_convite TO service_role;

ALTER TABLE public.tentativas_convite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário lê suas próprias tentativas"
  ON public.tentativas_convite FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- RPC consolidada: rate-limit + lookup + auditoria + entrada no grupo.
-- Retorna jsonb { status, grupo_id?, nome_grupo?, motivo?, tentativas_restantes? }
-- status ∈ ('ok','nao_encontrado','ja_membro','rate_limited','nao_autenticado')
CREATE OR REPLACE FUNCTION public.tentar_entrar_no_grupo(_codigo TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT := UPPER(TRIM(COALESCE(_codigo, '')));
  v_fails INT;
  v_grupo RECORD;
  v_ja_membro BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status','nao_autenticado');
  END IF;

  -- Rate limit: máx 5 tentativas inválidas nos últimos 15 minutos.
  SELECT COUNT(*) INTO v_fails
    FROM public.tentativas_convite
   WHERE user_id = v_uid
     AND sucesso = false
     AND criado_em > now() - INTERVAL '15 minutes';

  IF v_fails >= 5 THEN
    INSERT INTO public.tentativas_convite(user_id, codigo_tentado, sucesso, motivo)
      VALUES (v_uid, v_code, false, 'rate_limited');
    RETURN jsonb_build_object(
      'status','rate_limited',
      'motivo','Muitas tentativas. Aguarde 15 minutos.'
    );
  END IF;

  IF length(v_code) <> 6 THEN
    INSERT INTO public.tentativas_convite(user_id, codigo_tentado, sucesso, motivo)
      VALUES (v_uid, v_code, false, 'formato_invalido');
    RETURN jsonb_build_object('status','nao_encontrado','motivo','Código inválido');
  END IF;

  SELECT id, nome_grupo INTO v_grupo
    FROM public.grupos_familiares
   WHERE UPPER(TRIM(codigo_convite)) = v_code
   LIMIT 1;

  IF v_grupo.id IS NULL THEN
    INSERT INTO public.tentativas_convite(user_id, codigo_tentado, sucesso, motivo)
      VALUES (v_uid, v_code, false, 'nao_encontrado');
    RETURN jsonb_build_object(
      'status','nao_encontrado',
      'tentativas_restantes', GREATEST(0, 4 - v_fails)
    );
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.membros_grupo
    WHERE user_id = v_uid
  ) INTO v_ja_membro;

  IF v_ja_membro THEN
    INSERT INTO public.tentativas_convite(user_id, codigo_tentado, sucesso, motivo)
      VALUES (v_uid, v_code, false, 'ja_membro');
    RETURN jsonb_build_object('status','ja_membro','motivo','Você já está em um grupo.');
  END IF;

  INSERT INTO public.membros_grupo(grupo_id, user_id, papel)
    VALUES (v_grupo.id, v_uid, 'membro');

  INSERT INTO public.tentativas_convite(user_id, codigo_tentado, sucesso, motivo)
    VALUES (v_uid, v_code, true, 'entrou');

  RETURN jsonb_build_object(
    'status','ok',
    'grupo_id', v_grupo.id,
    'nome_grupo', v_grupo.nome_grupo
  );
END
$$;

REVOKE ALL ON FUNCTION public.tentar_entrar_no_grupo(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tentar_entrar_no_grupo(TEXT) TO authenticated;
