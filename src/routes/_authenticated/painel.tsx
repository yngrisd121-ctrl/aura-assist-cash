import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Landmark } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { useFinance } from "@/lib/db";
import {
  MONTHS,
  WEEKDAYS,
  addDaysISO,
  brl,
  buildInsights,
  closingMessage,
  formatDayLabel,
  parseISO,
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
  const [chartPeriod, setChartPeriod] = useState<"dia" | "semana" | "mes">("semana");

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
  const total = useMemo(
    () => periodStats(entries.filter((e) => e.date <= today)),
    [entries, today],
  );
  const balance = total.available;
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

  const chartFrom = chartPeriod === "dia" ? today : chartPeriod === "semana" ? weekStart : `${monthPrefix}-01`;
  const inChart = (iso: string) => iso >= chartFrom && iso <= today;

  const incomeChartData = useMemo(() => {
    if (chartPeriod === "dia") {
      return dayList
        .filter((e) => e.kind === "income")
        .sort((a, b) => hourOf(a).localeCompare(hourOf(b)))
        .map((e) => ({ label: hourOf(e), valor: Number(e.amount) || 0 }));
    }
    if (chartPeriod === "semana") {
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDaysISO(weekStart, i);
        const valor = entries
          .filter((e) => e.kind === "income" && e.date === d)
          .reduce((s, e) => s + Number(e.amount), 0);
        return { label: WEEKDAYS[parseISO(d).getDay()], valor };
      });
    }
    const dayCount = Number(today.slice(8, 10));
    return Array.from({ length: dayCount }, (_, i) => {
      const d = `${monthPrefix}-${String(i + 1).padStart(2, "0")}`;
      const valor = entries
        .filter((e) => e.kind === "income" && e.date === d)
        .reduce((s, e) => s + Number(e.amount), 0);
      return { label: String(i + 1), valor };
    });
  }, [chartPeriod, dayList, entries, weekStart, monthPrefix, today]);

  const expenseChartData = useMemo(() => {
    const map = new Map<string, number>();
    entries
      .filter((e) => e.kind !== "income" && e.kind !== "saving" && inChart(e.date))
      .forEach((e) => {
        const key = e.category || "Outros";
        map.set(key, (map.get(key) ?? 0) + (Number(e.amount) || 0));
      });
    return Array.from(map.entries())
      .map(([name, valor]) => ({ name, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [entries, chartFrom, today]);

  const expenseChartTotal = expenseChartData.reduce((s, d) => s + d.valor, 0);

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
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs opacity-90">Saldo disponível</p>
            <p className="font-display text-4xl">{brl(balance)}</p>
          </div>
          <span className="rounded-2xl bg-white/15 p-2" aria-hidden>
            <Landmark className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <MiniCard label="📥 Entrou" value={brl(total.received)} />
          <MiniCard label="📤 Gastei" value={brl(total.spent)} />
          <MiniCard label="💗 Guardei" value={brl(total.saved)} />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-lg">💕 Resumo de hoje</h2>
        <div className="mt-3 space-y-1.5 text-sm">
          <Row label="Entrou hoje" value={brl(day.received)} tone="primary" />
          <Row label="Gastei hoje" value={brl(day.spent)} />
          <Row label="Guardei hoje" value={brl(day.saved)} tone="lilac" />
          <Row label="Saldo disponível" value={brl(day.available)} tone="primary" />

        </div>
        <p className="mt-3 rounded-2xl bg-gradient-soft p-3 text-xs text-muted-foreground">
          {closingMessage(day)}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Stat label="💰 Lucro hoje" value={brl(day.available)} />
        <Stat label="💰 Lucro na semana" value={brl(week.available)} />
        <Stat label="💰 Lucro no mês" value={brl(month.available)} />
        <Stat label="📊 Recebido no mês" value={brl(month.received)} highlight />
        <Stat label="🧾 Gastos no mês" value={brl(month.spent)} />
        <Stat label="💗 Guardado no mês" value={brl(month.saved)} />
        <Stat label="💳 Total de dívidas" value={brl(debtsTotal)} />
        <Stat label="🎯 Falta p/ metas" value={brl(goalTarget)} />
        <Stat label="📅 Contas a vencer" value={brl(upcoming.reduce((s, b) => s + Number(b.amount), 0))} />
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg">💕 Entradas</h2>
          <PeriodTabs value={chartPeriod} onChange={setChartPeriod} />
        </div>
        {incomeChartData.some((d) => d.valor > 0) ? (
          <div className="mt-4 h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeChartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  formatter={(value: number) => [brl(value), "Entrou"]}
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="valor" fill="var(--primary)" radius={[8, 8, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma entrada no período. Toque no + para registrar. 💗
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg">📤 Gastos por categoria</h2>
          <PeriodTabs value={chartPeriod} onChange={setChartPeriod} />
        </div>
        {expenseChartData.length > 0 ? (
          <div className="mt-4 space-y-3">
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseChartData}
                    dataKey="valor"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={76}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {expenseChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [brl(value), "Gasto"]}
                    contentStyle={{
                      borderRadius: 16,
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-xs">
              {expenseChartData.map((d, i) => (
                <li key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="truncate">{d.name}</span>
                  </span>
                  <span className="shrink-0 font-semibold">
                    {brl(d.valor)}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({Math.round((d.valor / expenseChartTotal) * 100)}%)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum gasto no período. 🌷
          </p>
        )}
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
              {brl(day.received)}
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

const CHART_COLORS = [
  "var(--primary)",
  "var(--lilac)",
  "var(--rose-gold)",
  "var(--accent)",
  "var(--nude)",
  "var(--muted-foreground)",
];

function PeriodTabs({
  value,
  onChange,
}: {
  value: "dia" | "semana" | "mes";
  onChange: (v: "dia" | "semana" | "mes") => void;
}) {
  const options = [
    { id: "dia" as const, label: "Dia" },
    { id: "semana" as const, label: "Semana" },
    { id: "mes" as const, label: "Mês" },
  ];
  return (
    <div className="flex gap-1 rounded-full bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
            value === o.id
              ? "bg-primary text-primary-foreground shadow-soft"
              : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
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
