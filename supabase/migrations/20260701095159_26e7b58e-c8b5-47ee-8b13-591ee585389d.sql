-- Permitir que membros do mesmo grupo familiar editem/excluam despesas compartilhadas.
-- Continua bloqueando quem não é do grupo. O user_id (dono original) permanece imutável.
CREATE POLICY "Membros do grupo editam despesas"
  ON public.expenses
  FOR UPDATE
  TO authenticated
  USING (public.mesmo_grupo(auth.uid(), user_id))
  WITH CHECK (public.mesmo_grupo(auth.uid(), user_id) AND user_id = (SELECT user_id FROM public.expenses WHERE id = expenses.id));

CREATE POLICY "Membros do grupo excluem despesas"
  ON public.expenses
  FOR DELETE
  TO authenticated
  USING (public.mesmo_grupo(auth.uid(), user_id));