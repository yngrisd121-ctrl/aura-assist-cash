import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useFinance } from "@/lib/db";
import {
  MONTHS,
  addDaysISO,
  brl,
  buildInsights,
  closingMessage,
  formatDayLabel,
  periodStats,
  todayISO,
} from "@/lib/finance";
import { useRecordSheet } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { billOccurrences, monthSummary, usePayments } from "@/lib/obligations";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Rosé Finance" },
      {
        name: "description",
        content: "Seu dia financeiro: recebido, gasto, guardado e disponível em tempo real.",
      },
      { property: "og:title", content: "Painel — Rosé Finance" },
      {
        property: "og:description",
        content: "Seu dia financeiro: recebido, gasto, guardado e disponível em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

const hourOf = (e: { time_of_day?: string | null; created_at?: string }) => {
  if (e.time_of_day) return e.time_of_day.slice(0, 5);
  if (!e.created_at) return "--:--";
  const d = new Date(e.created_at);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function Painel() {
  const { entries, bills, debts, goals, isLoading } = useFinance();
  const sheet = useRecordSheet();

  const today = todayISO();
  const [y, m] = today.split("-");
  const monthPrefix = `${y}-${m}`;
  const in7 = addDaysISO(today, 7);

  const dayList = useMemo(() => entries.filter((e) => e.date === today), [entries, today]);
  const monthList = useMemo(
    () => entries.filter((e) => e.date.startsWith(monthPrefix)),
    [entries, monthPrefix],
  );

  const day = useMemo(() => periodStats(dayList), [dayList]);
  const month = useMemo(() => periodStats(monthList), [monthList]);
  const weekStart = addDaysISO(today, -6);
  const week = useMemo(
    () => periodStats(entries.filter((e) => e.date >= weekStart && e.date <= today)),
    [entries, weekStart, today],
  );

  const todayIncomes = useMemo(
    () =>
      dayList
        .filter((e) => e.kind === "income")
        .sort((a, b) => hourOf(a).localeCompare(hourOf(b))),
    [dayList],
  );

  const debtsTotal = useMemo(
    () =>
      debts.reduce((s, d) => s + Math.max(Number(d.total_amount) - Number(d.paid_amount), 0), 0),
    [debts],
  );
  const upcoming = useMemo(
    () => bills.filter((b) => !b.paid && b.due_date <= in7).slice(0, 4),
    [bills, in7],
  );
  const goalTarget = useMemo(
    () =>
      goals.reduce((s, g) => s + Math.max(Number(g.target_amount) - Number(g.saved_amount), 0), 0),
    [goals],
  );

  const insights = useMemo(
    () => buildInsights(entries, bills, debts, goals),
    [entries, bills, debts, goals],
  );

  const paymentsQuery = usePayments();
  const obligations = useMemo(
    () =>
      monthSummary(
        billOccurrences(bills, paymentsQuery.data ?? [], monthPrefix),
        debts,
        monthPrefix,
        today,
      ),
    [bills, debts, paymentsQuery.data, monthPrefix, today],
  );


  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted-foreground">
          {MONTHS[Number(m) - 1]} de {y}
        </p>
        <h1 className="font-display text-3xl">Seu painel 🌷</h1>
      </header>

      <section className="rounded-3xl bg-gradient-rose p-5 text-primary-foreground shadow-soft">
        <p className="text-xs opacity-90">Disponível para gastar hoje</p>
        <p className="font-display text-4xl">{brl(day.available)}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <MiniCard label="📥 Recebi" value={brl(day.received)} />
          <MiniCard label="📤 Gastei" value={brl(day.spent)} />
          <MiniCard label="💗 Guardei" value={brl(day.saved)} />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-lg">💕 Resumo de hoje</h2>
        <div className="mt-3 space-y-1.5 text-sm">
          <Row label="Entrou hoje" value={brl(day.received)} tone="primary" />
          <Row label="Gastei hoje" value={brl(day.spent)} />
          <Row label="Guardei hoje" value={brl(day.saved)} tone="lilac" />
          <Row label="Disponível para gastar" value={brl(day.available)} tone="primary" />
        </div>
        <p className="mt-3 rounded-2xl bg-gradient-soft p-3 text-xs text-muted-foreground">
          {closingMessage(day)}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Stat label="💰 Lucro hoje" value={brl(day.received - day.spent)} />
        <Stat label="💰 Lucro na semana" value={brl(week.received - week.spent)} />
        <Stat label="💰 Lucro no mês" value={brl(month.received - month.spent)} />
        <Stat label="📊 Recebido no mês" value={brl(month.received)} highlight />
        <Stat label="🧾 Gastos no mês" value={brl(month.spent)} />
        <Stat label="💗 Guardado no mês" value={brl(month.saved)} />
        <Stat label="💳 Total de dívidas" value={brl(debtsTotal)} />
        <Stat label="🎯 Falta p/ metas" value={brl(goalTarget)} />
        <Stat label="📅 Contas a vencer" value={brl(upcoming.reduce((s, b) => s + Number(b.amount), 0))} />
      </section>

      <Link
        to="/contas"
        className="block rounded-3xl border border-border bg-card p-5 shadow-soft active:scale-[0.99]"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">🧾 Contas e dívidas</h2>
          <span className="text-xs font-medium text-primary">Abrir</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <p>
            💰 Total do mês <strong className="block">{brl(obligations.total)}</strong>
          </p>
          <p>
            ✅ Já pago <strong className="block text-primary">{brl(obligations.paid)}</strong>
          </p>
          <p>
            🔴 Pendente <strong className="block">{brl(obligations.pending)}</strong>
          </p>
          <p>
            📊 Dívidas restantes{" "}
            <strong className="block">{brl(obligations.debtsRemaining)}</strong>
          </p>
        </div>
      </Link>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">💰 Meu dia financeiro</h2>
          <Link to="/historico" className="text-xs font-medium text-primary">
            Ver histórico
          </Link>
        </div>
        {todayIncomes.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum recebimento hoje ainda. Toque no + para registrar. 💗
          </p>
        )}
        {todayIncomes.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => sheet.open("income", { ...e, __type: "income" })}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-soft active:scale-[0.99]"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {hourOf(e)} — {e.description || e.category || "Entrada"}
              </span>
              <span className="block text-xs text-muted-foreground">
                {[e.category, e.method, e.client_name].filter(Boolean).join(" · ") || "Toque para editar"}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-primary">
              {brl(Number(e.amount))}
            </span>
          </button>
        ))}
        {todayIncomes.length > 0 && (
          <div className="flex justify-between rounded-2xl bg-gradient-soft p-4 text-sm font-medium">
            <span>Total recebido hoje</span>
            <span className="text-primary">
              {brl(day.received)} · {day.salesCount} entrada(s)
            </span>
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-lg">📅 Contas próximas</h2>
          {upcoming.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => sheet.open("bill", { ...b, __type: "bill" })}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-soft active:scale-[0.99]"
            >
              <span>
                <span className="block text-sm font-medium">{b.name}</span>
                <span
                  className={cn(
                    "block text-xs",
                    b.due_date < today ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {b.due_date < today ? "Atrasada — " : "Vence "}
                  {formatDayLabel(b.due_date)}
                </span>
              </span>
              <span className="text-sm font-semibold">{brl(Number(b.amount))}</span>
            </button>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-display text-lg">✨ Dicas inteligentes</h2>
        {insights.map((i, idx) => (
          <div
            key={idx}
            className="flex gap-3 rounded-2xl border border-border bg-card p-4 text-sm shadow-soft"
          >
            <span aria-hidden>{i.icon}</span>
            <p className="text-muted-foreground">{i.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/15 p-3">
      <p className="opacity-90">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "primary" | "lilac";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-semibold",
          tone === "primary" && "text-primary",
          tone === "lilac" && "text-lilac",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-lg", highlight && "text-primary")}>{value}</p>
    </div>
  );
}
