import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useFinance } from "@/lib/db";
import { brl, closingMessage, dayStats, formatDayLabel } from "@/lib/finance";
import { useRecordSheet } from "@/components/app-shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/historico/$date")({
  head: ({ params }) => ({
    meta: [
      { title: `Vendas de ${formatDayLabel(params.date)} — Rosé Finance` },
      {
        name: "description",
        content: `Veja todas as vendas registradas em ${formatDayLabel(params.date)}.`,
      },
      {
        property: "og:title",
        content: `Vendas de ${formatDayLabel(params.date)} — Rosé Finance`,
      },
      {
        property: "og:description",
        content: `Veja todas as vendas registradas em ${formatDayLabel(params.date)}.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoricoDia,
});

const hourOf = (e: { time_of_day?: string | null; created_at?: string }) => {
  if (e.time_of_day) return e.time_of_day.slice(0, 5);
  if (!e.created_at) return "—";
  const d = new Date(e.created_at);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};


function HistoricoDia() {
  const { date } = Route.useParams();
  const { entries } = useFinance();
  const sheet = useRecordSheet();

  const sales = useMemo(() => {
    return entries
      .filter((e) => e.kind === "income" && e.date === date)
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  }, [entries, date]);

  const stats = useMemo(() => dayStats(entries, date), [entries, date]);

  const PAGE = 30;
  const [visible, setVisible] = useState(PAGE);
  useEffect(() => setVisible(PAGE), [date]);
  const shown = useMemo(() => sales.slice(0, visible), [sales, visible]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visible >= sales.length) return;
    const io = new IntersectionObserver(
      (es) => es[0]?.isIntersecting && setVisible((v) => v + PAGE),
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, sales.length]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          to="/historico"
          className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-2xl">{formatDayLabel(date)}</h1>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <Stat label="Entrou no dia" value={brl(stats.received)} highlight />
        <Stat label="Gasto no dia" value={brl(stats.spent)} />
        <Stat label="Guardado no dia" value={brl(stats.saved)} />
        <Stat label="Saldo disponível" value={brl(stats.available)} highlight />
      </section>

      <p className="rounded-2xl bg-gradient-soft p-4 text-xs text-muted-foreground">
        {closingMessage(stats)}
      </p>

      <section className="space-y-2">
        {sales.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma venda neste dia.
          </p>
        )}

        {shown.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => sheet.open("income", { ...item, __type: "income" })}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition-transform active:scale-[0.99]"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {hourOf(item)} — {item.description || item.category || "Venda"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {[item.category, item.method, item.client_name, item.notes]
                  .filter(Boolean)
                  .join(" · ") || "Toque para editar"}
              </span>
            </span>

            <span className="shrink-0 text-sm font-semibold text-primary">
              {brl(Number(item.amount))}
            </span>
          </button>
        ))}

        {visible < sales.length && (
          <div ref={sentinelRef} className="py-3 text-center text-xs text-muted-foreground">
            Carregando mais vendas…
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
