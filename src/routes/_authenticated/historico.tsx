import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useFinance } from "@/lib/db";
import { addDaysISO, brl, formatDayLabel, todayISO } from "@/lib/finance";
import { useRecordSheet } from "@/components/app-shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de vendas — Rosé Finance" },
      {
        name: "description",
        content: "Veja quanto você vendeu em cada dia, com totais do dia, da semana e do mês.",
      },
      { property: "og:title", content: "Histórico de vendas — Rosé Finance" },
      {
        property: "og:description",
        content: "Veja quanto você vendeu em cada dia, com totais do dia, da semana e do mês.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Historico,
});

type Filter = "day" | "week" | "month";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "day", label: "Dia" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
];

const hourOf = (createdAt?: string) => {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function Historico() {
  const { entries } = useFinance();
  const sheet = useRecordSheet();
  const today = todayISO();
  const [filter, setFilter] = useState<Filter>("month");
  const [openDay, setOpenDay] = useState<string | null>(today);

  const sales = useMemo(() => entries.filter((e) => e.kind === "income"), [entries]);

  const monthPrefix = today.slice(0, 7);
  const weekStart = addDaysISO(today, -6);

  const totals = useMemo(() => {
    const t = { todayAmount: 0, todayCount: 0, monthAmount: 0, monthCount: 0 };
    sales.forEach((s) => {
      const amount = Number(s.amount);
      if (s.date === today) {
        t.todayAmount += amount;
        t.todayCount += 1;
      }
      if (s.date.startsWith(monthPrefix)) {
        t.monthAmount += amount;
        t.monthCount += 1;
      }
    });
    return t;
  }, [sales, today, monthPrefix]);

  const days = useMemo(() => {
    const filtered = sales.filter((s) => {
      if (filter === "day") return s.date === today;
      if (filter === "week") return s.date >= weekStart && s.date <= today;
      return s.date.startsWith(monthPrefix);
    });
    const map = new Map<string, typeof filtered>();
    filtered.forEach((s) => {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    });
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({
        date,
        items: [...items].sort((a, b) =>
          (b.created_at ?? "").localeCompare(a.created_at ?? ""),
        ),
        total: items.reduce((sum, i) => sum + Number(i.amount), 0),
      }));
  }, [sales, filter, today, weekStart, monthPrefix]);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl">Histórico</h1>

      <section className="grid grid-cols-2 gap-3">
        <Stat label="Vendido hoje" value={brl(totals.todayAmount)} highlight />
        <Stat label="Vendas hoje" value={`${totals.todayCount}`} />
        <Stat label="Vendido no mês" value={brl(totals.monthAmount)} highlight />
        <Stat label="Vendas no mês" value={`${totals.monthCount}`} />
      </section>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "flex-1 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-transparent bg-gradient-rose text-primary-foreground shadow-soft"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="space-y-2">
        {days.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma venda neste período. Toque no + para registrar.
          </p>
        )}

        {days.map((day) => {
          const expanded = openDay === day.date;
          return (
            <div
              key={day.date}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
            >
              <button
                type="button"
                onClick={() => setOpenDay(expanded ? null : day.date)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left active:scale-[0.99]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    📅 {formatDayLabel(day.date)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {day.items.length} {day.items.length === 1 ? "venda" : "vendas"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-sm font-semibold text-primary">{brl(day.total)}</span>
                  {expanded ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </span>
              </button>

              {expanded && (
                <ul className="border-t border-border/70 bg-muted/30">
                  {day.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => sheet.open("income", { ...item, __type: "income" })}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm">
                            {item.description || item.category || "Venda"}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {hourOf(item.created_at) ?? formatDayLabel(item.date)}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold">
                          {brl(Number(item.amount))}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-lg", highlight && "text-primary")}>{value}</p>
    </div>
  );
}
