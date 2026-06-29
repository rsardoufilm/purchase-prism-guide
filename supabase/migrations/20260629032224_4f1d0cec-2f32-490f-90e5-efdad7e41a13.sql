
-- 1) Retroactive reclassification of packaging items
UPDATE public.expense_items
SET category = 'Embalagens'
WHERE (category IS NULL OR category <> 'Embalagens')
  AND (
    lower(raw_name) ~ '(sacola|descart|saquinh|^sac |^sac$| sac | sac$|bolsa plast)'
    OR lower(coalesce(normalized_name,'')) ~ '(sacola|descart|saquinh|^sac |^sac$| sac | sac$)'
  );

-- 2) Harden SECURITY DEFINER functions used inside RLS policies:
--    enforce that the caller can only query about themselves.
CREATE OR REPLACE FUNCTION public.grupo_do_usuario(_user uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT grupo_id
  FROM public.membros_grupo
  WHERE user_id = _user
    AND _user = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.mesmo_grupo(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN auth.uid() IS NULL THEN false
      WHEN auth.uid() NOT IN (_a, _b) THEN false
      WHEN _a = _b THEN true
      ELSE EXISTS (
        SELECT 1
        FROM public.membros_grupo m1
        JOIN public.membros_grupo m2 ON m1.grupo_id = m2.grupo_id
        WHERE m1.user_id = _a AND m2.user_id = _b
      )
    END
$$;

-- 3) Lock down trigger-only SECURITY DEFINER functions: revoke direct EXECUTE
--    from clients. They keep working as triggers (which run as table owner).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promover_dicionario_global() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_atualizado_em() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_codigo_convite() FROM PUBLIC, anon, authenticated;
