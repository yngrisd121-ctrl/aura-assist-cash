import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFinance, useSavePercent, useUpdateProfile } from "@/lib/db";
import {
  addDaysISO,
  autoReminders,
  brl,
  buildStats,
  formatDayLabel,
  goalPace,

  todayISO,
} from "@/lib/finance";
import { useRecordSheet } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/mais")({
  head: () => ({
    meta: [
      { title: "Mais — Rosé Finance" },
      { name: "description", content: "Metas, dívidas, anotações e lembretes automáticos." },
      { property: "og:title", content: "Mais — Rosé Finance" },
      {
        property: "og:description",
        content: "Metas, dívidas, anotações e lembretes automáticos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Mais,
});

function Mais() {
  const { entries, bills, debts, goals, notes } = useFinance();
  const sheet = useRecordSheet();
  const navigate = useNavigate();
  const savePercent = useSavePercent();
  const updateProfile = useUpdateProfile();

  const reminders = useMemo(() => autoReminders(bills, debts, goals), [bills, debts, goals]);

  const today = todayISO();
  const monthPrefix = today.slice(0, 7);
  const weekStart = addDaysISO(today, -6);

  const monthEntries = useMemo(
    () => entries.filter((e) => e.date.startsWith(monthPrefix)),
    [entries, monthPrefix],
  );
  const stats = useMemo(() => buildStats(monthEntries), [monthEntries]);
  const savedWeek = useMemo(
    () =>
      entries
        .filter((e) => e.kind === "saving" && e.date >= weekStart && e.date <= today)
        .reduce((s, e) => s + Number(e.amount), 0),
    [entries, weekStart, today],
  );
  const savedToday = useMemo(
    () =>
      entries
        .filter((e) => e.kind === "saving" && e.date === today)
        .reduce((s, e) => s + Number(e.amount), 0),
    [entries, today],
  );

  const fixedBills = useMemo(
    () => bills.filter((b) => b.due_date.startsWith(monthPrefix)),
    [bills, monthPrefix],
  );
  const billsPaid = fixedBills.filter((b) => b.paid).reduce((s, b) => s + Number(b.amount), 0);
  const billsPending = fixedBills.filter((b) => !b.paid).reduce((s, b) => s + Number(b.amount), 0);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Mais</h1>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-lg">📈 Estatísticas do mês</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <p>
            🏆 Melhor dia{" "}
            <strong>
              {stats.bestDay ? `${formatDayLabel(stats.bestDay.date)} — ${brl(stats.bestDay.amount)}` : "—"}
            </strong>
          </p>
          <p>
            📊 Média/dia <strong>{brl(stats.avgPerDay)}</strong>
          </p>
          <p>
            💰 Lucro no mês <strong>{brl(stats.totalReceived - stats.totalSpent)}</strong>
          </p>
          <p>
            💵 Média por venda <strong>{brl(stats.avgPerSale)}</strong>
          </p>
          <p>
            ⬆️ Maior entrada <strong>{brl(stats.biggest)}</strong>
          </p>
          <p>
            📤 Total gasto <strong>{brl(stats.totalSpent)}</strong>
          </p>
          <p>
            💗 Total guardado <strong>{brl(stats.totalSaved)}</strong>
          </p>
          <p>
            💯 % guardado <strong>{stats.savedPercent.toFixed(0)}%</strong>
          </p>
        </div>
        <p className="mt-3 rounded-2xl bg-gradient-soft p-3 text-xs text-muted-foreground">
          Você recebeu em média {brl(stats.avgPerDay)} por dia este mês. 💕
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-lg">💗 Guardar dinheiro</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Porcentagem sugerida ao registrar uma entrada.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[5, 10, 15, 20].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => updateProfile.mutate({ save_percent: p })}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-medium",
                savePercent === p
                  ? "border-transparent bg-gradient-rose text-primary-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {p}%
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <p>
            Hoje <strong className="block">{brl(savedToday)}</strong>
          </p>
          <p>
            Semana <strong className="block">{brl(savedWeek)}</strong>
          </p>
          <p>
            Mês <strong className="block">{brl(stats.totalSaved)}</strong>
          </p>
        </div>
        <Button variant="outline" className="mt-3 w-full" onClick={() => sheet.open("saving")}>
          Guardar dinheiro agora
        </Button>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">🧾 Contas do mês</h2>
          <Link to="/contas" className="text-xs font-medium text-primary">
            Contas e dívidas
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-gradient-soft p-4 text-xs">
          <p>
            Total <strong className="block">{brl(billsPaid + billsPending)}</strong>
          </p>
          <p>
            ✅ Pagas <strong className="block">{brl(billsPaid)}</strong>
          </p>
          <p>
            ⏳ Pendentes <strong className="block">{brl(billsPending)}</strong>
          </p>
        </div>
        {fixedBills.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => sheet.open("bill", { ...b, __type: "bill" })}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-soft active:scale-[0.99]"
          >
            <span>
              <span className="block text-sm font-medium">
                {b.name} {b.recurring ? "🔁" : ""}
              </span>
              <span className="block text-xs text-muted-foreground">
                {b.paid ? "✅ Pago" : "⏳ Pendente"} • {formatDayLabel(b.due_date)}
              </span>
            </span>
            <span className="text-sm font-semibold">{brl(Number(b.amount))}</span>
          </button>
        ))}
        <Button variant="outline" className="w-full" onClick={() => sheet.open("bill")}>
          Nova conta
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg">Lembretes</h2>
        {reminders.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum lembrete para os próximos dias.
          </p>
        )}
        {reminders.map((r) => (
          <div
            key={r.id}
            className="flex gap-3 rounded-2xl border border-border bg-card p-4 text-sm shadow-soft"
          >
            <span aria-hidden>{r.icon}</span>
            <p className="text-muted-foreground">{r.text}</p>
          </div>
        ))}
      </section>


      <section className="space-y-2">
        <h2 className="font-display text-lg">Metas</h2>
        {goals.map((g) => {
          const pct = Math.min(
            100,
            Math.round((Number(g.saved_amount) / Math.max(Number(g.target_amount), 1)) * 100),
          );
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => sheet.open("goal", { ...g, __type: "goal" })}
              className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-soft active:scale-[0.99]"
            >
              <div className="flex justify-between text-sm font-medium">
                <span>{g.name}</span>
                <span>
                  {brl(Number(g.saved_amount))} / {brl(Number(g.target_amount))}
                </span>
              </div>
              <Progress value={pct} className="mt-2 h-2" />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Faltam {brl(goalPace(g).missing)}
                {goalPace(g).perDay > 0
                  ? ` · guarde ${brl(goalPace(g).perDay)} por dia até o prazo`
                  : ""}
              </p>

            </button>
          );
        })}
        <Button variant="outline" className="w-full" onClick={() => sheet.open("goal")}>
          Nova meta
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg">Dívidas</h2>
        {debts.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => sheet.open("debt", { ...d, __type: "debt" })}
            className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-soft active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{d.name}</span>
              <span className="text-sm font-semibold">
                Falta {brl(Number(d.total_amount) - Number(d.paid_amount))}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total {brl(Number(d.total_amount))} · Pago {brl(Number(d.paid_amount))} ·{" "}
              {d.installments_paid}/{d.installments_total} parcelas · {formatDayLabel(d.due_date)}
            </p>
            <Progress
              value={Math.min(
                100,
                Math.round((Number(d.paid_amount) / Math.max(Number(d.total_amount), 1)) * 100),
              )}
              className="mt-2 h-2"
            />
          </button>

        ))}
        <Button variant="outline" className="w-full" onClick={() => sheet.open("debt")}>
          Nova dívida
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg">Anotações</h2>
        {notes.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => sheet.open("note", { ...n, __type: "note" })}
            className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-soft active:scale-[0.99]"
          >
            <span className="block text-sm font-medium">{n.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{n.content}</span>
          </button>
        ))}
        <Button variant="outline" className="w-full" onClick={() => sheet.open("note")}>
          Nova anotação
        </Button>
      </section>

      <Button variant="ghost" className="w-full text-muted-foreground" onClick={logout}>
        <LogOut className="mr-2 size-4" /> Sair da conta
      </Button>
    </div>
  );
}
