import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/db";
import {
  MONTHS,
  brl,
  buildInsights,
  buildSnapshot,
  formatDayLabel,
  todayISO,
} from "@/lib/finance";
import { useRecordSheet } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Rosé Finance" },
      { name: "description", content: "Resumo do mês: entradas, gastos, contas e metas." },
      { property: "og:title", content: "Painel — Rosé Finance" },
      { property: "og:description", content: "Resumo do mês: entradas, gastos, contas e metas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { entries, bills, debts, goals, isLoading } = useFinance();
  const sheet = useRecordSheet();

  const today = todayISO();
  const [y, m] = today.split("-");
  const from = `${y}-${m}-01`;
  const to = `${y}-${m}-31`;

  const snap = useMemo(
    () => buildSnapshot(entries, bills, debts, goals, from, to),
    [entries, bills, debts, goals, from, to],
  );
  const insights = useMemo(
    () => buildInsights(entries, bills, debts, goals),
    [entries, bills, debts, goals],
  );

  const monthEntries = entries.filter((e) => e.date >= from && e.date <= to);
  const recent = entries.slice(0, 8);
  const max = Math.max(snap.received, snap.spent, 1);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-3xl" />
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
        <h1 className="font-display text-3xl text-foreground">Seu painel</h1>
      </header>

      <section className="rounded-3xl bg-gradient-rose p-5 text-primary-foreground shadow-soft">
        <p className="text-xs opacity-90">Disponível para gastar</p>
        <p className="font-display text-4xl">{brl(snap.available)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-2xl bg-white/15 p-3">
            <p className="opacity-90">Entradas</p>
            <p className="text-base font-semibold">{brl(snap.received)}</p>
          </div>
          <div className="rounded-2xl bg-white/15 p-3">
            <p className="opacity-90">Gastos</p>
            <p className="text-base font-semibold">{brl(snap.spent)}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Stat label="Contas a pagar" value={brl(snap.upcomingBills)} />
        <Stat label="Dívidas" value={brl(snap.upcomingDebts)} />
        <Stat label="Guardar p/ metas" value={brl(snap.goalTarget)} />
        <Stat label="Lançamentos" value={String(monthEntries.length)} />
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-lg">Entradas x Gastos</h2>
        <div className="mt-4 space-y-3">
          <Bar label="Entradas" value={snap.received} max={max} className="bg-primary" />
          <Bar label="Gastos" value={snap.spent} max={max} className="bg-accent" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg">Dicas inteligentes</h2>
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

      <section className="space-y-2">
        <h2 className="font-display text-lg">Últimos lançamentos</h2>
        {recent.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nada por aqui ainda. Toque no + para começar.
          </p>
        )}
        {recent.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => sheet.open(e.kind, { ...e, __type: e.kind })}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-soft active:scale-[0.99]"
          >
            <span>
              <span className="block text-sm font-medium">{e.title || e.category}</span>
              <span className="block text-xs text-muted-foreground">{formatDayLabel(e.date)}</span>
            </span>
            <span
              className={cn(
                "text-sm font-semibold",
                e.kind === "income" ? "text-primary" : "text-foreground",
              )}
            >
              {e.kind === "income" ? "+" : "-"}
              {brl(Number(e.amount))}
            </span>
          </button>
        ))}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg">{value}</p>
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  className,
}: {
  label: string;
  value: number;
  max: number;
  className: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{brl(value)}</span>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", className)}
          style={{ width: `${Math.round((value / max) * 100)}%` }}
        />
      </div>
    </div>
  );
}
