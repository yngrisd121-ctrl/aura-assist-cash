import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useFinance } from "@/lib/db";
import { MONTHS, brl, formatDayLabel, todayISO } from "@/lib/finance";
import {
  billOccurrences,
  debtInstallments,
  debtRemaining,
  monthKey,
  monthLabelKey,
  monthSummary,
  usePartialDebtPayment,
  usePayBill,
  usePayInstallment,
  usePayments,
  useUndoBillPayment,
  useUndoDebtPayment,
  type BillOccurrence,
  type Payment,
} from "@/lib/obligations";
import { useRecordSheet } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/contas")({
  head: () => ({
    meta: [
      { title: "Contas e Dívidas — Rosé Finance" },
      {
        name: "description",
        content:
          "Contas fixas recorrentes, dívidas parceladas, pagamentos e quanto ainda falta pagar no mês.",
      },
      { property: "og:title", content: "Contas e Dívidas — Rosé Finance" },
      {
        property: "og:description",
        content: "Organize contas fixas, parcelas e pagamentos do mês em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Contas,
});

type Tab = "contas" | "dividas" | "historico";

function Contas() {
  const { bills, debts } = useFinance();
  const paymentsQuery = usePayments();
  const payments = useMemo(() => paymentsQuery.data ?? [], [paymentsQuery.data]);
  const sheet = useRecordSheet();

  const today = todayISO();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y as number, month: (m as number) - 1 };
  });
  const [tab, setTab] = useState<Tab>("contas");

  const mKey = monthLabelKey(cursor.year, cursor.month);
  const occurrences = useMemo(
    () => billOccurrences(bills, payments, mKey),
    [bills, payments, mKey],
  );
  const summary = useMemo(
    () => monthSummary(occurrences, debts, mKey, today),
    [occurrences, debts, mKey, today],
  );

  const move = (delta: number) => {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">Contas e Dívidas</h1>
          <p className="text-xs text-muted-foreground">
            {MONTHS[cursor.month]} de {cursor.year}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => move(-1)}
            className="rounded-full border border-border bg-card p-2 active:scale-95"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => move(1)}
            className="rounded-full border border-border bg-card p-2 active:scale-95"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </header>

      <section className="rounded-3xl bg-gradient-rose p-5 text-primary-foreground shadow-soft">
        <p className="text-xs opacity-90">💰 Total a pagar no mês</p>
        <p className="font-display text-4xl">{brl(summary.total)}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <Mini label="✅ Já pago" value={brl(summary.paid)} />
          <Mini label="🔴 Pendente" value={brl(summary.pending)} />
          <Mini label="📊 Dívidas" value={brl(summary.debtsRemaining)} />
        </div>
        {summary.overdue > 0 && (
          <p className="mt-3 rounded-2xl bg-white/15 p-3 text-xs">
            ⚠️ {brl(summary.overdue)} em atraso. Que tal resolver hoje? 💗
          </p>
        )}
      </section>

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-1">
        {(
          [
            ["contas", "🧾 Contas"],
            ["dividas", "💳 Dívidas"],
            ["historico", "🕒 Pagos"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-xl px-2 py-2 text-xs font-medium transition-colors",
              tab === key ? "bg-gradient-rose text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "contas" && (
        <BillsTab occurrences={occurrences} month={mKey} today={today} onNew={() => sheet.open("bill")} />
      )}
      {tab === "dividas" && <DebtsTab />}
      {tab === "historico" && <HistoryTab payments={payments} month={mKey} />}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/15 p-3">
      <p className="opacity-90">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function BillsTab({
  occurrences,
  month,
  today,
  onNew,
}: {
  occurrences: BillOccurrence[];
  month: string;
  today: string;
  onNew: () => void;
}) {
  const sheet = useRecordSheet();
  const pay = usePayBill();
  const undo = useUndoBillPayment();

  return (
    <section className="space-y-2">
      {occurrences.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhuma conta neste mês. Cadastre aluguel, energia, internet… 💗
        </p>
      )}
      {occurrences.map((o) => (
        <div
          key={`${o.bill.id}-${o.month}`}
          className="rounded-2xl border border-border bg-card p-4 shadow-soft"
        >
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => sheet.open("bill", { ...o.bill, __type: "bill" })}
              className="min-w-0 text-left"
            >
              <span className="block truncate text-sm font-medium">
                {o.bill.name} {o.bill.recurring ? "🔁" : ""}
              </span>
              <span
                className={cn(
                  "block text-xs",
                  o.paid
                    ? "text-primary"
                    : o.due_date < today
                      ? "text-destructive"
                      : "text-muted-foreground",
                )}
              >
                {o.paid ? "✅ Paga" : o.due_date < today ? "🔴 Atrasada" : "⏳ Pendente"} ·{" "}
                {formatDayLabel(o.due_date)}
                {o.bill.bill_type ? ` · ${o.bill.bill_type}` : ""}
              </span>
            </button>
            <span className="shrink-0 text-sm font-semibold">{brl(o.amount)}</span>
          </div>
          <Button
            variant={o.paid ? "outline" : "default"}
            size="sm"
            className="mt-3 w-full"
            disabled={pay.isPending || undo.isPending}
            onClick={() =>
              o.paid
                ? undo.mutate(
                    { bill: o.bill, payment: o.payment },
                    { onSuccess: () => toast.success("Pagamento desfeito") },
                  )
                : pay.mutate(
                    { bill: o.bill, month, amount: o.amount },
                    { onSuccess: () => toast.success(`${o.bill.name} paga! 💗`) },
                  )
            }
          >
            {o.paid ? "Desfazer pagamento" : "Marcar como paga"}
          </Button>
        </div>
      ))}
      <Button variant="outline" className="w-full" onClick={onNew}>
        Nova conta
      </Button>
    </section>
  );
}

function DebtsTab() {
  const { debts } = useFinance();
  const sheet = useRecordSheet();

  return (
    <section className="space-y-3">
      {debts.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhuma dívida cadastrada. 🌷
        </p>
      )}
      {debts.map((d) => (
        <DebtCard key={d.id} debtId={d.id} />
      ))}
      <Button variant="outline" className="w-full" onClick={() => sheet.open("debt")}>
        Nova dívida
      </Button>
    </section>
  );
}

function DebtCard({ debtId }: { debtId: string }) {
  const { debts } = useFinance();
  const debt = debts.find((d) => d.id === debtId);
  const sheet = useRecordSheet();
  const payInstallment = usePayInstallment();
  const partial = usePartialDebtPayment();
  const [showAll, setShowAll] = useState(false);
  const [partialValue, setPartialValue] = useState("");

  const installments = useMemo(() => (debt ? debtInstallments(debt) : []), [debt]);
  if (!debt) return null;

  const remaining = debtRemaining(debt);
  const pct = Math.min(
    100,
    Math.round((Number(debt.paid_amount) / Math.max(Number(debt.total_amount), 1)) * 100),
  );
  const nextIndex = installments.findIndex((i) => !i.paid);
  const visible = showAll ? installments : installments.slice(Math.max(nextIndex, 0), Math.max(nextIndex, 0) + 3);

  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
      <button
        type="button"
        onClick={() => sheet.open("debt", { ...debt, __type: "debt" })}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {debt.name} {debt.debt_type ? <span className="text-muted-foreground">· {debt.debt_type}</span> : null}
          </span>
          <span className="text-sm font-semibold text-primary">Falta {brl(remaining)}</span>
        </div>
        <Progress value={pct} className="mt-2 h-2" />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Pago {brl(Number(debt.paid_amount))} de {brl(Number(debt.total_amount))} ·{" "}
          {debt.installments_paid}/{debt.installments_total} parcelas ·{" "}
          {Math.max(Number(debt.installments_total) - Number(debt.installments_paid), 0)} restantes
        </p>
      </button>

      <div className="mt-3 space-y-2">
        {visible.map((i) => (
          <div
            key={i.number}
            className="flex items-center justify-between gap-2 rounded-2xl bg-gradient-soft p-3 text-xs"
          >
            <span>
              <strong>
                Parcela {i.number}/{debt.installments_total}
              </strong>
              <span className="block text-muted-foreground">
                {formatDayLabel(i.due_date)} · {brl(i.amount)}
              </span>
            </span>
            {i.paid ? (
              <span className="font-medium text-primary">✅ Paga</span>
            ) : (
              <Button
                size="sm"
                disabled={payInstallment.isPending}
                onClick={() =>
                  payInstallment.mutate(
                    { debt, installment: i },
                    { onSuccess: () => toast.success("Parcela paga! 💗") },
                  )
                }
              >
                Marcar como paga
              </Button>
            )}
          </div>
        ))}
        {installments.length > visible.length && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-full text-center text-[11px] font-medium text-primary"
          >
            Ver todas as {installments.length} parcelas
          </button>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          inputMode="decimal"
          placeholder="Pagamento parcial R$"
          value={partialValue}
          onChange={(e) => setPartialValue(e.target.value)}
          className="h-10"
        />
        <Button
          variant="outline"
          className="h-10 shrink-0"
          disabled={partial.isPending}
          onClick={() => {
            const value = Number(partialValue.replace(",", ".")) || 0;
            if (!value) {
              toast.error("Informe o valor");
              return;
            }
            partial.mutate(
              { debt, amount: value },
              {
                onSuccess: () => {
                  setPartialValue("");
                  toast.success("Pagamento registrado 💗");
                },
              },
            );
          }}
        >
          Registrar
        </Button>
      </div>
    </div>
  );
}

function HistoryTab({ payments, month }: { payments: Payment[]; month: string }) {
  const { bills, debts } = useFinance();
  const undoBill = useUndoBillPayment();
  const undoDebt = useUndoDebtPayment();

  const list = payments.filter((p) => monthKey(p.paid_date) === month);
  const total = list.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <section className="space-y-2">
      <div className="rounded-2xl bg-gradient-soft p-4 text-sm font-medium">
        <span className="text-muted-foreground">Pago neste mês</span>
        <span className="float-right text-primary">{brl(total)}</span>
      </div>
      {list.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum pagamento registrado neste mês.
        </p>
      )}
      {list.map((p) => {
        const bill = bills.find((b) => b.id === p.bill_id);
        const debt = debts.find((d) => d.id === p.debt_id);
        return (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {bill ? `🧾 ${bill.name}` : debt ? `💳 ${debt.name}` : "Pagamento"}
                {p.installments ? " (parcela)" : p.note === "parcial" ? " (parcial)" : ""}
              </span>
              <span className="block text-xs text-muted-foreground">
                {formatDayLabel(p.paid_date)}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-semibold">{brl(Number(p.amount))}</span>
              <button
                type="button"
                className="text-[11px] font-medium text-muted-foreground underline"
                onClick={() => {
                  if (bill) {
                    undoBill.mutate(
                      { bill, payment: p },
                      { onSuccess: () => toast.success("Pagamento desfeito") },
                    );
                  } else if (debt) {
                    undoDebt.mutate(
                      { debt, payment: p },
                      { onSuccess: () => toast.success("Pagamento desfeito") },
                    );
                  }
                }}
              >
                desfazer
              </button>
            </span>
          </div>
        );
      })}
    </section>
  );
}
