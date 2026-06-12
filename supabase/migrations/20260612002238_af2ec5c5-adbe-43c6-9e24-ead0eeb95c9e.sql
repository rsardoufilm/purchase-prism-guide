DROP POLICY IF EXISTS "write normalization" ON public.product_normalization;
DROP POLICY IF EXISTS "update normalization" ON public.product_normalization;

CREATE POLICY "write normalization" ON public.product_normalization
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "update normalization" ON public.product_normalization
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);