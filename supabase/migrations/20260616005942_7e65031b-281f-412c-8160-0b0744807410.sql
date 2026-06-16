DROP POLICY IF EXISTS "update normalization" ON public.product_normalization;
DROP POLICY IF EXISTS "insert normalization" ON public.product_normalization;
REVOKE INSERT, UPDATE, DELETE ON public.product_normalization FROM authenticated, anon;
GRANT SELECT ON public.product_normalization TO authenticated, anon;
GRANT ALL ON public.product_normalization TO service_role;