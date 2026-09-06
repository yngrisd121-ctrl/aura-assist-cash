import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Bill, Debt, Entry, Goal, Note, Reminder } from "./finance";

export type TableName = "entries" | "bills" | "debts" | "goals" | "notes" | "reminders";

async function fetchAll<T>(table: TableName, order: string, asc = false): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("*").order(order, { ascending: asc });
  if (error) throw error;
  return (data ?? []) as T[];
}

const opts = { staleTime: 60_000, gcTime: 10 * 60_000 };

export function useEntries() {
  return useQuery({ queryKey: ["entries"], queryFn: () => fetchAll<Entry>("entries", "date"), ...opts });
}
export function useBills() {
  return useQuery({ queryKey: ["bills"], queryFn: () => fetchAll<Bill>("bills", "due_date", true), ...opts });
}
export function useDebts() {
  return useQuery({ queryKey: ["debts"], queryFn: () => fetchAll<Debt>("debts", "due_date", true), ...opts });
}
export function useGoals() {
  return useQuery({ queryKey: ["goals"], queryFn: () => fetchAll<Goal>("goals", "created_at"), ...opts });
}
export function useNotes() {
  return useQuery({ queryKey: ["notes"], queryFn: () => fetchAll<Note>("notes", "date"), ...opts });
}
export function useReminders() {
  return useQuery({
    queryKey: ["reminders"],
    queryFn: () => fetchAll<Reminder>("reminders", "date", true),
    ...opts,
  });
}

export function useFinance() {
  const entries = useEntries();
  const bills = useBills();
  const debts = useDebts();
  const goals = useGoals();
  const notes = useNotes();
  const reminders = useReminders();
  return {
    entries: entries.data ?? [],
    bills: bills.data ?? [],
    debts: debts.data ?? [],
    goals: goals.data ?? [],
    notes: notes.data ?? [],
    reminders: reminders.data ?? [],
    isLoading:
      entries.isLoading || bills.isLoading || debts.isLoading || goals.isLoading || notes.isLoading,
  };
}

export function useSaveRecord(table: TableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      record: Record<string, unknown> & { id?: string },
    ): Promise<{ id: string }> => {
      const { data: auth } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query = supabase.from(table) as any;
      const { data, error } = record.id
        ? await query.update(record).eq("id", record.id).select("id").maybeSingle()
        : await query
            .insert({ ...record, user_id: auth.user?.id })
            .select("id")
            .maybeSingle();
      if (error) throw error;
      return { id: (data?.id as string) ?? (record.id as string) };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}


export function useDeleteRecord(table: TableName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}

export type Profile = { id: string; display_name: string | null; save_percent: number };

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
      if (error) throw error;
      return (data as unknown as Profile) ?? null;
    },
    staleTime: 5 * 60_000,
  });
}

export function useSavePercent() {
  const { data } = useProfile();
  return Number(data?.save_percent ?? 10);
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão expirada");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query = supabase.from("profiles") as any;
      const { error } = await query.update(patch).eq("id", auth.user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export type Category = { id: string; name: string; emoji: string; kind: string };

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Category[];
    },
    ...opts,
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: { id?: string; name: string; kind: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query = supabase.from("categories") as any;
      const { error } = record.id
        ? await query.update({ name: record.name }).eq("id", record.id)
        : await query.insert({ name: record.name, kind: record.kind, user_id: auth.user?.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useSeedCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { name: string; kind: string }[]) => {
      if (!rows.length) return;
      const { data: auth } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query = supabase.from("categories") as any;
      const { error } = await query.insert(
        rows.map((r) => ({ ...r, user_id: auth.user?.id })),
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}
