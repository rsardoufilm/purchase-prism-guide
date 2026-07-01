DROP POLICY IF EXISTS "Membros do grupo editam despesas" ON public.expenses;

CREATE POLICY "Membros do grupo editam despesas"
ON public.expenses
FOR UPDATE
TO authenticated
USING (public.mesmo_grupo(auth.uid(), user_id))
WITH CHECK (public.mesmo_grupo(auth.uid(), user_id));