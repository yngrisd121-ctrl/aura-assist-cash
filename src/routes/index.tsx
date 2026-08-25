import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rosé Finance — controle financeiro simples e bonito" },
      {
        name: "description",
        content:
          "Organize entradas, gastos, contas, dívidas e metas em um app rápido, leve e feito para o dia a dia.",
      },
      { property: "og:title", content: "Rosé Finance — controle financeiro simples e bonito" },
      {
        property: "og:description",
        content: "Entradas, gastos, contas, dívidas e metas em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/painel" });
  },
});
