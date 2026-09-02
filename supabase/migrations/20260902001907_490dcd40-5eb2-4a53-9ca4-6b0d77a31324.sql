ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS save_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saved_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_entry_id uuid REFERENCES public.entries(id) ON DELETE SET NULL;

ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS available_amount numeric GENERATED ALWAYS AS (amount - saved_amount) STORED;

CREATE INDEX IF NOT EXISTS entries_source_entry_id_idx ON public.entries(source_entry_id);