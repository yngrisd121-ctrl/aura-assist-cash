import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Bill, Debt } from "./finance";
import { todayISO } from "./finance";

export type Payment = {
  id: string;
  bill_id: string | null;
  debt_id: string | null;
  entry_id: string | null;
  amount: number;
  paid_date: string;
  reference_month: string | null;
  installments: number;
  note: string | null;
};

export const BILL_TYPES = [
  "Aluguel",
  "Energia",
  "Água",
  "Internet",
  "Telefone",
  "Cartão",
  "Assinatura",
  "Escola",
  "Condomínio",
  "Outro",
];

export const DEBT_TYPES = [
  "Cartão",
  "Empréstimo",
  "Financiamento",
  "Crediário",
  "Parcelamento",
  "Pessoa",
  "Outro",
];

export const monthKey = (iso: string) => iso.slice(0, 7);

export const monthLabelKey = (year: number, month: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}`;

export function dueDateForMonth(mKey: string, day: number) {
  const [y, m] = mKey.split("-").map(Number);
  const last = new Date(y as number, m as number, 0).getDate();
  return `${mKey}-${String(Math.min(Math.max(day, 1), last)).padStart(2, "0")}`;
}

export function addMonthsISO(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(y as number, (m as number) - 1 + months, 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const day = Math.min(d as number, last);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type BillOccurrence = {
  bill: Bill;
  month: string;
  due_date: string;
  amount: number;
  paid: boolean;
  payment: Payment | null;
};

/** Contas do mês: recorrentes aparecem todo mês, avulsas só no mês do vencimento. */
export function billOccurrences(
  bills: Bill[],
  payments: Payment[],
  mKey: string,
): BillOccurrence[] {
  const list: BillOccurrence[] = [];
  bills.forEach((b) => {
    const recurring = b.recurring && b.active !== false;
    if (recurring) {
      if (monthKey(b.due_date) > mKey) return;
    } else if (monthKey(b.due_date) !== mKey) {
      return;
    }
    const day = b.due_day ?? Number(b.due_date.slice(8)) ?? 1;
    const due = recurring ? dueDateForMonth(mKey, day) : b.due_date;
    const payment =
      payments.find((p) => p.bill_id === b.id && p.reference_month === mKey) ?? null;
    list.push({
      bill: b,
      month: mKey,
      due_date: due,
      amount: Number(b.amount),
      paid: Boolean(payment) || (!recurring && b.paid),
      payment,
    });
  });
  return list.sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export type Installment = {
  number: number;
  due_date: string;
  amount: number;
  paid: boolean;
};

export function debtInstallments(debt: Debt): Installment[] {
  const total = Math.max(1, Number(debt.installments_total) || 1);
  const value =
    Number(debt.installment_amount) > 0
      ? Number(debt.installment_amount)
      : Number(debt.total_amount) / total;
  return Array.from({ length: total }, (_, i) => ({
    number: i + 1,
    due_date: addMonthsISO(debt.due_date, i),
    amount: Math.round(value * 100) / 100,
    paid: i + 1 <= Number(debt.installments_paid),
  }));
}

export const debtRemaining = (d: Debt) =>
  Math.max(Number(d.total_amount) - Number(d.paid_amount), 0);

export type ObligationsSummary = {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  debtsRemaining: number;
};

export function monthSummary(
  occurrences: BillOccurrence[],
  debts: Debt[],
  mKey: string,
  today = todayISO(),
): ObligationsSummary {
  const debtDue = debts.flatMap((d) =>
    debtInstallments(d).filter((i) => monthKey(i.due_date) === mKey).map((i) => ({ ...i })),
  );
  const total =
    occurrences.reduce((s, o) => s + o.amount, 0) + debtDue.reduce((s, i) => s + i.amount, 0);
  const paid =
    occurrences.filter((o) => o.paid).reduce((s, o) => s + o.amount, 0) +
    debtDue.filter((i) => i.paid).reduce((s, i) => s + i.amount, 0);
  const overdue =
    occurrences
      .filter((o) => !o.paid && o.due_date < today)
      .reduce((s, o) => s + o.amount, 0) +
    debtDue.filter((i) => !i.paid && i.due_date < today).reduce((s, i) => s + i.amount, 0);
  return {
    total,
    paid,
    pending: total - paid,
    overdue,
    debtsRemaining: debts.reduce((s, d) => s + debtRemaining(d), 0),
  };
}

/* ------------------------------- data layer ------------------------------- */

export function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("paid_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Payment[];
    },
    staleTime: 60_000,
  });
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Sessão expirada");
  return id;
}

async function createEntry(input: {
  user_id: string;
  amount: number;
  description: string;
  category: string | null;
  date: string;
}) {
  const { data, error } = await supabase
    .from("entries")
    .insert({
      user_id: input.user_id,
      kind: "fixed",
      amount: input.amount,
      description: input.description,
      category: input.category,
      date: input.date,
      paid: true,
      recurring: false,
      quantity: 1,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

function useObligationMutation<T>(fn: (input: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      ["payments", "entries", "bills", "debts"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
    },
  });
}

export function usePayBill() {
  return useObligationMutation(
    async ({
      bill,
      month,
      amount,
      date,
    }: {
      bill: Bill;
      month: string;
      amount: number;
      date?: string;
    }) => {
      const user_id = await currentUserId();
      const paid_date = date ?? todayISO();
      const entry_id = await createEntry({
        user_id,
        amount,
        description: bill.name,
        category: bill.bill_type ?? bill.category ?? "Conta",
        date: paid_date,
      });
      const { error } = await supabase.from("payments").insert({
        user_id,
        bill_id: bill.id,
        entry_id,
        amount,
        paid_date,
        reference_month: month,
        installments: 0,
      });
      if (error) throw error;
      if (!bill.recurring) {
        await supabase.from("bills").update({ paid: true }).eq("id", bill.id);
      }
    },
  );
}

export function useUndoBillPayment() {
  return useObligationMutation(
    async ({ bill, payment }: { bill: Bill; payment: Payment | null }) => {
      if (payment) {
        if (payment.entry_id) await supabase.from("entries").delete().eq("id", payment.entry_id);
        const { error } = await supabase.from("payments").delete().eq("id", payment.id);
        if (error) throw error;
      }
      if (!bill.recurring) {
        await supabase.from("bills").update({ paid: false }).eq("id", bill.id);
      }
    },
  );
}

export function usePayInstallment() {
  return useObligationMutation(
    async ({
      debt,
      installment,
      amount,
    }: {
      debt: Debt;
      installment: Installment;
      amount?: number;
    }) => {
      const user_id = await currentUserId();
      const value = amount ?? installment.amount;
      const paid_date = todayISO();
      const entry_id = await createEntry({
        user_id,
        amount: value,
        description: `${debt.name} — parcela ${installment.number}/${debt.installments_total}`,
        category: debt.debt_type ?? "Dívida",
        date: paid_date,
      });
      const { error } = await supabase.from("payments").insert({
        user_id,
        debt_id: debt.id,
        entry_id,
        amount: value,
        paid_date,
        reference_month: monthKey(installment.due_date),
        installments: 1,
      });
      if (error) throw error;
      const { error: upErr } = await supabase
        .from("debts")
        .update({
          installments_paid: Math.min(
            Number(debt.installments_total),
            Number(debt.installments_paid) + 1,
          ),
          paid_amount: Math.min(Number(debt.total_amount), Number(debt.paid_amount) + value),
        })
        .eq("id", debt.id);
      if (upErr) throw upErr;
    },
  );
}

export function usePartialDebtPayment() {
  return useObligationMutation(async ({ debt, amount }: { debt: Debt; amount: number }) => {
    const user_id = await currentUserId();
    const paid_date = todayISO();
    const entry_id = await createEntry({
      user_id,
      amount,
      description: `${debt.name} — pagamento parcial`,
      category: debt.debt_type ?? "Dívida",
      date: paid_date,
    });
    const { error } = await supabase.from("payments").insert({
      user_id,
      debt_id: debt.id,
      entry_id,
      amount,
      paid_date,
      reference_month: monthKey(paid_date),
      installments: 0,
      note: "parcial",
    });
    if (error) throw error;
    const { error: upErr } = await supabase
      .from("debts")
      .update({ paid_amount: Math.min(Number(debt.total_amount), Number(debt.paid_amount) + amount) })
      .eq("id", debt.id);
    if (upErr) throw upErr;
  });
}

export function useUndoDebtPayment() {
  return useObligationMutation(async ({ debt, payment }: { debt: Debt; payment: Payment }) => {
    if (payment.entry_id) await supabase.from("entries").delete().eq("id", payment.entry_id);
    const { error } = await supabase.from("payments").delete().eq("id", payment.id);
    if (error) throw error;
    const { error: upErr } = await supabase
      .from("debts")
      .update({
        paid_amount: Math.max(0, Number(debt.paid_amount) - Number(payment.amount)),
        installments_paid: Math.max(0, Number(debt.installments_paid) - payment.installments),
      })
      .eq("id", debt.id);
    if (upErr) throw upErr;
  });
}
