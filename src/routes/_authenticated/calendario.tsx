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
      { name: "description", content: "Veja entradas, gastos e contas por dia, semana ou mês." },
      { property: "og:title", content: "Calendário — Rosé Finance" },
      {
        property: "og:description",
        content: "Veja entradas, gastos e contas por dia, semana ou mês.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Calendario;
});

function Calendario() {
  return null;
}
