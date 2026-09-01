ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS due_day integer,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bill_type text;

UPDATE public.bills SET due_day = EXTRACT(DAY FROM due_date)::int WHERE due_day IS NULL;

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS installment_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS debt_type text,
  ADD COLUMN IF NOT EXISTS notes text;

UPDATE public.debts
SET installment_amount = ROUND(total_amount / GREATEST(installments_total, 1), 2)
WHERE installment_amount = 0;

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bill_id uuid REFERENCES public.bills(id) ON DELETE CASCADE,
  debt_id uuid REFERENCES public.debts(id) ON DELETE CASCADE,
  entry_id uuid REFERENCES public.entries(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  paid_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_month text,
  installments integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own payments" ON public.payments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS payments_user_date_idx ON public.payments (user_id, paid_date DESC);
CREATE INDEX IF NOT EXISTS payments_bill_month_idx ON public.payments (bill_id, reference_month);
CREATE INDEX IF NOT EXISTS payments_debt_idx ON public.payments (debt_id);