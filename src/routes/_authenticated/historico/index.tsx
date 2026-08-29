import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useFinance } from "@/lib/db";
import { addDaysISO, brl, formatDayLabel, todayISO } from "@/lib/finance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/historico/")({
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

function Historico() {
  const { entries } = useFinance();
  const today = todayISO();
  const [filter, setFilter] = useState<Filter>("month");
  const monthPrefix = today.slice(0, 7);
  const weekStart = addDaysISO(today, -6);

  const sales = useMemo(() => entries.filter((e) => e.kind === "income"), [entries]);

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

  const inRange = useMemo(() => {
    return (date: string) => {
      if (filter === "day") return date === today;
      if (filter === "week") return date >= weekStart && date <= today;
      return date.startsWith(monthPrefix);
    };
  }, [filter, today, weekStart, monthPrefix]);

  const periodEntries = useMemo(
    () => entries.filter((e) => inRange(e.date)),
    [entries, inRange],
  );
  const stats = useMemo(() => buildStats(periodEntries), [periodEntries]);

  const days = useMemo(() => {
    const filtered = sales.filter((s) => inRange(s.date));
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
  }, [sales, inRange]);

  const chart = useMemo(() => {
    const list = [...days].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
    const max = Math.max(...list.map((d) => d.total), 1);
    return { list, max };
  }, [days]);


  const PAGE = 20;
  const [visible, setVisible] = useState(PAGE);
  useEffect(() => setVisible(PAGE), [filter]);
  const shownDays = useMemo(() => days.slice(0, visible), [days, visible]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visible >= days.length) return;
    const io = new IntersectionObserver(
      (es) => es[0]?.isIntersecting && setVisible((v) => v + PAGE),
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, days.length]);

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

        {shownDays.map((day) => (
          <Link
            key={day.date}
            to="/historico/$date"
            params={{ date: day.date }}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition-transform active:scale-[0.99]"
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
              <ChevronRight className="size-4 text-muted-foreground" />
            </span>
          </Link>
        ))}

        {visible < days.length && (
          <div ref={sentinelRef} className="py-3 text-center text-xs text-muted-foreground">
            Carregando mais dias…
          </div>
        )}
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
