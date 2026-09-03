export type EntryKind = "income" | "expense" | "fixed" | "saving";

export type Entry = {
  id: string;
  kind: EntryKind;
  amount: number;
  description: string;
  category: string | null;
  date: string;
  paid: boolean;
  recurring: boolean;
  created_at?: string;
  time_of_day?: string | null;
  method?: string | null;
  client_name?: string | null;
  notes?: string | null;
  quantity?: number | null;
  save_percent?: number | null;
  saved_amount?: number | null;
  available_amount?: number | null;
  source_entry_id?: string | null;

};


export type Bill = {
  id: string;
  name: string;
  amount: number;
  due_date: string;
  paid: boolean;
  recurring: boolean;
  category: string | null;
  due_day?: number | null;
  active?: boolean | null;
  bill_type?: string | null;
};

export type Debt = {
  id: string;
  name: string;
  total_amount: number;
  paid_amount: number;
  due_date: string;
  installments_total: number;
  installments_paid: number;
  installment_amount?: number | null;
  debt_type?: string | null;
  notes?: string | null;
};

export type Goal = {
  id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  deadline: string | null;
  save_amount?: number | null;
  save_period?: string | null;
};


export type Note = { id: string; title: string; content: string; date: string };
export type Reminder = { id: string; title: string; date: string; done: boolean };

export const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const parseISO = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

export const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const addDaysISO = (iso: string, days: number) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
};

export const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export const formatDayLabel = (iso: string) => {
  const d = parseISO(iso);
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
};

export type Snapshot = {
  received: number;
  spent: number;
  upcomingBills: number;
  upcomingDebts: number;
  goalTarget: number;
  available: number;
};

export function buildSnapshot(
  entries: Entry[],
  bills: Bill[],
  debts: Debt[],
  goals: Goal[],
  from: string,
  to: string,
): Snapshot {
  const inRange = (iso: string) => iso >= from && iso <= to;
  const received = entries
    .filter((e) => e.kind === "income" && inRange(e.date))
    .reduce((s, e) => s + Number(e.amount), 0);
  const spent = entries
    .filter((e) => e.kind !== "income" && e.kind !== "saving" && inRange(e.date))
    .reduce((s, e) => s + Number(e.amount), 0);
  const savedInRange = entries
    .filter((e) => e.kind === "saving" && inRange(e.date))
    .reduce((s, e) => s + Number(e.amount), 0);

  const upcomingBills = bills
    .filter((b) => !b.paid && inRange(b.due_date))
    .reduce((s, b) => s + Number(b.amount), 0);
  const upcomingDebts = debts
    .filter((d) => inRange(d.due_date))
    .reduce((s, d) => s + Math.max(Number(d.total_amount) - Number(d.paid_amount), 0), 0);
  const goalTarget = goals.reduce(
    (s, g) => s + Math.max(Number(g.target_amount) - Number(g.saved_amount), 0),
    0,
  );
  const goalSlice = goals.length ? Math.min(goalTarget, received * 0.1) : 0;
  return {
    received,
    spent,
    upcomingBills,
    upcomingDebts,
    goalTarget: goalSlice,
    available:
      received - spent - savedInRange - upcomingBills - upcomingDebts - goalSlice,

  };
}

export type Insight = { icon: string; text: string; tone: "info" | "good" | "warn" };

export function buildInsights(
  entries: Entry[],
  bills: Bill[],
  debts: Debt[],
  goals: Goal[],
): Insight[] {
  const today = todayISO();
  const in7 = addDaysISO(today, 7);
  const week0 = addDaysISO(today, -7);
  const out: Insight[] = [];

  const pending = bills.filter((b) => !b.paid && b.due_date >= today && b.due_date <= in7);
  const pendingSum = pending.reduce((s, b) => s + Number(b.amount), 0);
  if (pendingSum > 0) {
    out.push({
      icon: "💡",
      text: `Você tem ${brl(pendingSum)} em contas pendentes nos próximos 7 dias.`,
      tone: "warn",
    });
  }

  const weekIncome = entries
    .filter((e) => e.kind === "income" && e.date >= week0 && e.date <= today)
    .reduce((s, e) => s + Number(e.amount), 0);
  if (weekIncome > 0) {
    out.push({ icon: "💰", text: `Você recebeu ${brl(weekIncome)} esta semana.`, tone: "good" });
  }

  const goal = goals.find((g) => Number(g.saved_amount) < Number(g.target_amount));
  if (goal) {
    const missing = Number(goal.target_amount) - Number(goal.saved_amount);
    const days = goal.deadline
      ? Math.max(
          1,
          Math.round((parseISO(goal.deadline).getTime() - Date.now()) / 86_400_000),
        )
      : 30;
    out.push({
      icon: "🎯",
      text: `Para alcançar "${goal.name}", tente guardar ${brl(missing / days)} por dia.`,
      tone: "info",
    });
  }

  const late = bills.filter((b) => !b.paid && b.due_date < today);
  if (late.length) {
    out.push({
      icon: "⚠️",
      text: `${late.length} conta(s) em atraso somando ${brl(late.reduce((s, b) => s + Number(b.amount), 0))}.`,
      tone: "warn",
    });
  }

  const debt = debts.find((d) => d.due_date >= today && d.due_date <= in7);
  if (debt) {
    out.push({
      icon: "💳",
      text: `Parcela de "${debt.name}" vence em ${formatDayLabel(debt.due_date)}.`,
      tone: "warn",
    });
  }

  if (!out.length) {
    out.push({ icon: "💚", text: "Tudo em dia por aqui. Continue assim!", tone: "good" });
  }
  return out;
}

export function autoReminders(bills: Bill[], debts: Debt[], goals: Goal[]) {
  const today = todayISO();
  const in7 = addDaysISO(today, 7);
  const items: { id: string; icon: string; text: string; date: string }[] = [];
  bills
    .filter((b) => !b.paid && b.due_date <= in7)
    .forEach((b) =>
      items.push({
        id: `b-${b.id}`,
        icon: "🏠",
        date: b.due_date,
        text:
          b.due_date < today
            ? `${b.name} de ${brl(Number(b.amount))} está atrasada.`
            : b.due_date === today
              ? `${b.name} de ${brl(Number(b.amount))} vence hoje.`
              : `${b.name} de ${brl(Number(b.amount))} vence em ${formatDayLabel(b.due_date)}.`,
      }),
    );
  debts
    .filter((d) => d.due_date <= in7 && Number(d.paid_amount) < Number(d.total_amount))
    .forEach((d) =>
      items.push({
        id: `d-${d.id}`,
        icon: "💳",
        date: d.due_date,
        text: `Parcela ${d.installments_paid + 1}/${d.installments_total} de ${d.name} — ${formatDayLabel(d.due_date)}.`,
      }),
    );
  goals
    .filter((g) => g.deadline && g.deadline <= addDaysISO(today, 30))
    .forEach((g) =>
      items.push({
        id: `g-${g.id}`,
        icon: "🎯",
        date: g.deadline!,
        text: `Meta "${g.name}": faltam ${brl(Number(g.target_amount) - Number(g.saved_amount))}.`,
      }),
    );
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

// ===== Estatísticas do dia / período =====

export type DayStats = {
  received: number;
  spent: number;
  saved: number;
  available: number;
  incomeCount: number;
  salesCount: number;
};

export function dayStats(entries: Entry[], date: string): DayStats {
  return periodStats(entries.filter((e) => e.date === date));
}

export function periodStats(list: Entry[]): DayStats {
  const s: DayStats = {
    received: 0,
    spent: 0,
    saved: 0,
    available: 0,
    incomeCount: 0,
    salesCount: 0,
  };
  list.forEach((e) => {
    const amount = Number(e.amount) || 0;
    if (e.kind === "income") {
      s.received += amount;
      s.incomeCount += 1;
      s.salesCount += Number(e.quantity ?? 1) || 1;
    } else if (e.kind === "saving") {
      s.saved += amount;
    } else {
      s.spent += amount;
    }
  });
  s.available = s.received - s.spent - s.saved;
  return s;
}

export const inMonth = (iso: string, prefix: string) => iso.startsWith(prefix);

export const monthPrefixOf = (iso: string) => iso.slice(0, 7);

export function closingMessage(s: DayStats) {
  if (!s.received && !s.spent && !s.saved) {
    return "Ainda não há movimentações hoje. Toque no + para registrar. 🌷";
  }
  const parts = [`Entrou ${brl(s.received)} hoje.`];
  if (s.spent) parts.push(`Gastou ${brl(s.spent)}.`);
  if (s.saved) parts.push(`Guardou ${brl(s.saved)}.`);
  parts.push(`Seu saldo disponível ficou em ${brl(s.available)}. 💕`);
  return parts.join(" ");
}

export type FullStats = {
  bestDay: { date: string; amount: number } | null;
  avgPerDay: number;
  avgPerSale: number;
  biggest: number;
  totalReceived: number;
  totalSales: number;
  totalSaved: number;
  totalSpent: number;
  savedPercent: number;
  balance: number;
};

export function buildStats(list: Entry[]): FullStats {
  const base = periodStats(list);
  const byDay = new Map<string, number>();
  let biggest = 0;
  list
    .filter((e) => e.kind === "income")
    .forEach((e) => {
      const amount = Number(e.amount) || 0;
      biggest = Math.max(biggest, amount);
      byDay.set(e.date, (byDay.get(e.date) ?? 0) + amount);
    });
  let bestDay: { date: string; amount: number } | null = null;
  byDay.forEach((amount, date) => {
    if (!bestDay || amount > bestDay.amount) bestDay = { date, amount };
  });
  const days = byDay.size || 1;
  return {
    bestDay,
    avgPerDay: base.received / days,
    avgPerSale: base.salesCount ? base.received / base.salesCount : 0,
    biggest,
    totalReceived: base.received,
    totalSales: base.salesCount,
    totalSaved: base.saved,
    totalSpent: base.spent,
    savedPercent: base.received ? (base.saved / base.received) * 100 : 0,
    balance: base.available,
  };
}

export function goalPace(goal: Goal) {
  const missing = Math.max(Number(goal.target_amount) - Number(goal.saved_amount), 0);
  if (!goal.deadline) return { missing, perDay: 0, days: 0 };
  const days = Math.max(
    1,
    Math.ceil((parseISO(goal.deadline).getTime() - Date.now()) / 86_400_000),
  );
  return { missing, perDay: missing / days, days };
}
