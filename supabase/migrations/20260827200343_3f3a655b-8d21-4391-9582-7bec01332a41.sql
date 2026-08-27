ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS time_of_day text,
  ADD COLUMN IF NOT EXISTS method text,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS save_percent numeric NOT NULL DEFAULT 10;

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS save_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS save_period text NOT NULL DEFAULT 'month';

CREATE INDEX IF NOT EXISTS entries_user_date_idx ON public.entries (user_id, date DESC);
CREATE INDEX IF NOT EXISTS bills_user_due_idx ON public.bills (user_id, due_date);
CREATE INDEX IF NOT EXISTS debts_user_due_idx ON public.debts (user_id, due_date);