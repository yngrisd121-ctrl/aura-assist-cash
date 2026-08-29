import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFinance } from "@/lib/db";
import { MONTHS, WEEKDAYS, brl, formatDayLabel, toISO, todayISO } from "@/lib/finance";
import { useRecordSheet } from "@/components/app-shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário — Rosé Finance" },
      { name: "description", content: "Veja entradas, gastos e contas por dia e por mês." },
      { property: "og:title", content: "Calendário — Rosé Finance" },
      { property: "og:description", content: "Veja entradas, gastos e contas por dia e por mês." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Calendario,
});

type DayItem = {
  id: string;
  label: string;
  amount: number;
  positive: boolean;
  onOpen: () => void;
};

function Calendario() {
  const { entries, bills, notes, reminders } = useFinance();
  const sheet = useRecordSheet();

  const today = todayISO();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y as number, month: (m as number) - 1 };
  });
  const [selected, setSelected] = useState(today);

  const days = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const total = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const lead = first.getDay();
    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= total; d += 1) cells.push(toISO(new Date(cursor.year, cursor.month, d)));
    return cells;
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    const bump = (iso: string, key: "income" | "expense", value: number) => {
      const cur = map.get(iso) ?? { income: 0, expense: 0 };
      cur[key] += value;
      map.set(iso, cur);
    };
    entries.forEach((e) =>
      bump(e.date, e.kind === "income" ? "income" : "expense", Number(e.amount)),
    );
    bills.forEach((b) => bump(b.due_date, "expense", Number(b.amount)));
    return map;
  }, [entries, bills]);

  const dayItems: DayItem[] = useMemo(() => {
    const list: DayItem[] = [];
    entries
      .filter((e) => e.date === selected)
      .forEach((e) =>
        list.push({
          id: `e-${e.id}`,
          label: e.description || e.category || "Lançamento",
          amount: Number(e.amount),
          positive: e.kind === "income",
          onOpen: () => sheet.open(e.kind, { ...e, __type: e.kind }),
        }),
      );
    bills
      .filter((b) => b.due_date === selected)
      .forEach((b) =>
        list.push({
          id: `b-${b.id}`,
          label: `${b.name}${b.paid ? " (paga)" : ""}`,
          amount: Number(b.amount),
          positive: false,
          onOpen: () => sheet.open("bill", { ...b, __type: "bill" }),
        }),
      );
    return list;
  }, [entries, bills, selected, sheet]);

  const move = (delta: number) => {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl">
          {MONTHS[cursor.month]} <span className="text-muted-foreground">{cursor.year}</span>
        </h1>
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

      <section className="rounded-3xl border border-border bg-card p-3 shadow-soft">
        <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
          {WEEKDAYS.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((iso, i) => {
            if (!iso) return <span key={`x-${i}`} />;
            const info = byDay.get(iso);
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors",
                  selected === iso
                    ? "bg-primary text-primary-foreground"
                    : iso === today
                      ? "bg-muted font-semibold"
                      : "hover:bg-muted",
                )}
              >
                {Number(iso.slice(8))}
                <span className="mt-0.5 flex gap-0.5">
                  {info?.income ? <Dot className="bg-primary" active={selected === iso} /> : null}
                  {info?.expense ? <Dot className="bg-accent" active={selected === iso} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg">{formatDayLabel(selected)}</h2>
        {dayItems.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum registro neste dia.
          </p>
        )}
        {dayItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onOpen}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-soft active:scale-[0.99]"
          >
            <span className="text-sm font-medium">{item.label}</span>
            <span
              className={cn(
                "text-sm font-semibold",
                item.positive ? "text-primary" : "text-foreground",
              )}
            >
              {item.positive ? "+" : "-"}
              {brl(item.amount)}
            </span>
          </button>
        ))}
      </section>
    </div>
  );
}

function Dot({ className, active }: { className: string; active: boolean }) {
  return <span className={cn("size-1.5 rounded-full", active ? "bg-white" : className)} />;
}
