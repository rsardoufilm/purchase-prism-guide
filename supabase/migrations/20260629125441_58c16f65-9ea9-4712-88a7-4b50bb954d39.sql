
-- Função SECURITY DEFINER para permitir que qualquer usuário autenticado
-- localize um grupo pelo código de convite sem expor a tabela inteira via RLS.
CREATE OR REPLACE FUNCTION public.buscar_grupo_por_codigo(_codigo text)
RETURNS TABLE (id uuid, nome_grupo text, codigo_convite text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.nome_grupo, g.codigo_convite
  FROM public.grupos_familiares g
  WHERE auth.uid() IS NOT NULL
    AND UPPER(TRIM(g.codigo_convite)) = UPPER(TRIM(_codigo))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_grupo_por_codigo(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.buscar_grupo_por_codigo(text) FROM anon, public;
