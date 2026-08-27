import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useFinance } from "@/lib/db";
import { brl, formatDayLabel } from "@/lib/finance";
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

const hourOf = (createdAt?: string) => {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
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

  const total = useMemo(() => sales.reduce((s, e) => s + Number(e.amount), 0), [sales]);

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
        <Stat label="Total vendido" value={brl(total)} highlight />
        <Stat label="Quantidade" value={`${sales.length}`} />
      </section>

      <section className="space-y-2">
        {sales.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma venda neste dia.
          </p>
        )}

        {sales.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => sheet.open("income", { ...item, __type: "income" })}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition-transform active:scale-[0.99]"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {item.description || item.category || "Venda"}
              </span>
              <span className="block text-xs text-muted-foreground">
                {hourOf(item.created_at) ?? "—"}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-primary">
              {brl(Number(item.amount))}
            </span>
          </button>
        ))}
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
