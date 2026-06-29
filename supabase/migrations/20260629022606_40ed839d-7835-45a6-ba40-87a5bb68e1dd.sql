
CREATE TABLE public.product_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alias_normalized text NOT NULL,
  canonical_normalized text NOT NULL,
  same_product boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, alias_normalized, canonical_normalized)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_aliases TO authenticated;
GRANT ALL ON public.product_aliases TO service_role;

ALTER TABLE public.product_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own aliases"
  ON public.product_aliases
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_product_aliases_user_alias ON public.product_aliases(user_id, alias_normalized);
CREATE INDEX idx_product_aliases_user_canonical ON public.product_aliases(user_id, canonical_normalized);

CREATE TRIGGER trg_product_aliases_updated
  BEFORE UPDATE ON public.product_aliases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
