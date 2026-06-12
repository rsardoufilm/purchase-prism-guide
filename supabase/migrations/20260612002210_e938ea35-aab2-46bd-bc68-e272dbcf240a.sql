-- =========================================================
-- AURA — Arquitetura oficial
-- =========================================================

-- Remove tabelas antigas (substituídas pelo novo schema)
DROP TABLE IF EXISTS public.receipt_items CASCADE;
DROP TABLE IF EXISTS public.receipts CASCADE;
DROP TABLE IF EXISTS public.normalized_products CASCADE;
DROP TABLE IF EXISTS public.recurring_bills CASCADE;
DROP TYPE IF EXISTS public.receipt_source CASCADE;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM
    ('pix','credito','debito','dinheiro','vale_alimentacao','vale_refeicao','outros');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.expense_source AS ENUM ('manual','photo','pdf');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.recurrence_frequency AS ENUM
    ('mensal','bimestral','trimestral','semestral','anual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- EXPENSES
-- =========================================================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_time TIME,
  merchant_name TEXT NOT NULL,
  merchant_document TEXT,
  category TEXT,
  payment_method public.payment_method NOT NULL DEFAULT 'outros',
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  source public.expense_source NOT NULL DEFAULT 'manual',
  storage_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own expenses" ON public.expenses FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX expenses_user_date_idx ON public.expenses (user_id, expense_date DESC);
CREATE INDEX expenses_user_category_idx ON public.expenses (user_id, category);
CREATE INDEX expenses_user_merchant_idx ON public.expenses (user_id, merchant_name);
CREATE INDEX expenses_user_payment_idx ON public.expenses (user_id, payment_method);

CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- EXPENSE_ITEMS
-- =========================================================
CREATE TABLE public.expense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_name TEXT NOT NULL,
  normalized_name TEXT,
  category TEXT,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit TEXT,
  unit_price NUMERIC(12,4) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_items TO authenticated;
GRANT ALL ON public.expense_items TO service_role;
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own expense items" ON public.expense_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX expense_items_expense_idx ON public.expense_items (expense_id);
CREATE INDEX expense_items_user_normalized_idx ON public.expense_items (user_id, normalized_name);
CREATE INDEX expense_items_user_category_idx ON public.expense_items (user_id, category);

-- =========================================================
-- PRODUCT_NORMALIZATION (cache global compartilhado)
-- =========================================================
CREATE TABLE public.product_normalization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_name TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_normalization TO anon, authenticated;
GRANT INSERT, UPDATE ON public.product_normalization TO authenticated;
GRANT ALL ON public.product_normalization TO service_role;
ALTER TABLE public.product_normalization ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read normalization" ON public.product_normalization
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "write normalization" ON public.product_normalization
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update normalization" ON public.product_normalization
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX product_normalization_normalized_idx ON public.product_normalization (normalized_name);

-- =========================================================
-- PRODUCT_PRICES (histórico de preços por usuário)
-- =========================================================
CREATE TABLE public.product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  normalized_name TEXT NOT NULL,
  merchant_name TEXT NOT NULL,
  unit_price NUMERIC(12,4) NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit TEXT,
  purchase_date DATE NOT NULL,
  expense_item_id UUID REFERENCES public.expense_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_prices TO authenticated;
GRANT ALL ON public.product_prices TO service_role;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prices" ON public.product_prices FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX product_prices_user_normalized_date_idx
  ON public.product_prices (user_id, normalized_name, purchase_date DESC);
CREATE INDEX product_prices_user_merchant_idx
  ON public.product_prices (user_id, merchant_name);

-- =========================================================
-- RECURRING_EXPENSES (substitui recurring_bills)
-- =========================================================
CREATE TABLE public.recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  frequency public.recurrence_frequency NOT NULL DEFAULT 'mensal',
  due_day INT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_expenses TO authenticated;
GRANT ALL ON public.recurring_expenses TO service_role;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recurring expenses" ON public.recurring_expenses FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX recurring_expenses_user_idx ON public.recurring_expenses (user_id, active);