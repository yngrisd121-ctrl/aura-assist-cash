import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useFinance } from "@/lib/db";
import {
  MONTHS,
  brl,
  buildInsights,
  closingMessage,
  dayStats,
  formatDayLabel,
  periodStats,
  todayISO,
} from "@/lib/finance";
import { useRecordSheet } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Rosé Finance" },
      {
        name: "description",
        content: "Seu dia financeiro: recebido, gasto, guardado e disponível em tempo real.",
      },
      { property: "og:title", content: "Painel — Rosé Finance" },
      {
        property: "og:description",
        content: "Seu dia financeiro: recebido, gasto, guardado e disponível em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel;
});

function Painel() {
  return null;
}
