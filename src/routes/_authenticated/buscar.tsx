import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useFinance } from "@/lib/db";
import { brl, formatDayLabel } from "@/lib/finance";
import { useRecordSheet } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import type { RecordType } from "@/components/record-sheet";

export const Route = createFileRoute("/_authenticated/buscar")({
  head: () => ({
    meta: [
      { title: "Buscar — Rosé Finance" },
      { name: "description", content: "Busca global em lançamentos, contas, dívidas e metas." },
      { property: "og:title", content: "Buscar — Rosé Finance" },
      {
        property: "og:description",
        content: "Busca global em lançamentos, contas, dívidas e metas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Buscar,
});

type Hit = {
  id: string;
  type: RecordType;
  title: string;
  subtitle: string;
  amount?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
};

function Buscar() {
  const { entries, bills, debts, goals, notes, reminders } = useFinance();
  const sheet = useRecordSheet();
  const [q, setQ] = useState("");

  const all: Hit[] = useMemo(() => {
    const list: Hit[] = [];
    entries.forEach((e) =>
      list.push({
        id: `e-${e.id}`,
        type: e.kind,
        title: e.title || e.category || "Lançamento",
        subtitle: formatDayLabel(e.date),
        amount: Number(e.amount),
        raw: e,
      }),
    );
    bills.forEach((b) =>
      list.push({
        id: `b-${b.id}`,
        type: "bill",
        title: b.name,
        subtitle: `Conta • ${formatDayLabel(b.due_date)}`,
        amount: Number(b.amount),
        raw: b,
      }),
    );
    debts.forEach((d) =>
      list.push({
        id: `d-${d.id}`,
        type: "debt",
        title: d.name,
        subtitle: `Dívida • ${formatDayLabel(d.due_date)}`,
        amount: Number(d.total_amount) - Number(d.paid_amount),
        raw: d,
      }),
    );
    goals.forEach((g) =>
      list.push({
        id: `g-${g.id}`,
        type: "goal",
        title: g.name,
        subtitle: "Meta",
        amount: Number(g.target_amount),
        raw: g,
      }),
    );
    notes.forEach((n) =>
      list.push({
        id: `n-${n.id}`,
        type: "note",
        title: n.title,
        subtitle: n.content?.slice(0, 60) ?? "Anotação",
        raw: n,
      }),
    );
    reminders.forEach((r) =>
      list.push({
        id: `r-${r.id}`,
        type: "reminder",
        title: r.title,
        subtitle: `Lembrete • ${formatDayLabel(r.date)}`,
        raw: r,
      }),
    );
    return list;
  }, [entries, bills, debts, goals, notes, reminders]);

  const term = q.trim().toLowerCase();
  const results = term
    ? all.filter((h) => `${h.title} ${h.subtitle}`.toLowerCase().includes(term)).slice(0, 60)
    : all.slice(0, 20);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">Buscar</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar contas, gastos, metas..."
          className="pl-9"
          aria-label="Buscar"
        />
      </div>

      <div className="space-y-2">
        {results.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nada encontrado.
          </p>
        )}
        {results.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => sheet.open(h.type, { ...h.raw, __type: h.type })}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-soft active:scale-[0.99]"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{h.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{h.subtitle}</span>
            </span>
            {h.amount !== undefined && (
              <span className="ml-3 shrink-0 text-sm font-semibold">{brl(h.amount)}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
