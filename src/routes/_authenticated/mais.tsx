import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFinance } from "@/lib/db";
import { autoReminders, brl, formatDayLabel } from "@/lib/finance";
import { useRecordSheet } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

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
  const { bills, debts, goals, notes } = useFinance();
  const sheet = useRecordSheet();
  const navigate = useNavigate();

  const reminders = useMemo(() => autoReminders(bills, debts, goals), [bills, debts, goals]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Mais</h1>

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
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-soft active:scale-[0.99]"
          >
            <span>
              <span className="block text-sm font-medium">{d.name}</span>
              <span className="block text-xs text-muted-foreground">
                {d.installments_paid}/{d.installments_total} • {formatDayLabel(d.due_date)}
              </span>
            </span>
            <span className="text-sm font-semibold">
              {brl(Number(d.total_amount) - Number(d.paid_amount))}
            </span>
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
