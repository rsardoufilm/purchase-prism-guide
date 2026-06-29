
REVOKE EXECUTE ON FUNCTION public.grupo_do_usuario(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mesmo_grupo(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gerar_codigo_convite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grupo_do_usuario(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mesmo_grupo(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gerar_codigo_convite() TO authenticated, service_role;
