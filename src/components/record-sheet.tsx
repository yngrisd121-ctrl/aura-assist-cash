import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteRecord, useSaveRecord, type TableName } from "@/lib/db";
import { todayISO } from "@/lib/finance";
import { cn } from "@/lib/utils";

export type RecordType =
  | "income"
  | "expense"
  | "fixed"
  | "bill"
  | "debt"
  | "goal"
  | "note"
  | "reminder";

export const RECORD_TYPES: { key: RecordType; label: string; emoji: string }[] = [
  { key: "income", label: "Recebi", emoji: "💰" },
  { key: "expense", label: "Gastei", emoji: "🛍️" },
  { key: "fixed", label: "Gasto fixo", emoji: "🔁" },
  { key: "bill", label: "Conta", emoji: "🏠" },
  { key: "debt", label: "Dívida", emoji: "💳" },
  { key: "goal", label: "Meta", emoji: "🎯" },
  { key: "note", label: "Anotação", emoji: "📝" },
  { key: "reminder", label: "Lembrete", emoji: "🔔" },
];

const TABLE: Record<RecordType, TableName> = {
  income: "entries",
  expense: "entries",
  fixed: "entries",
  bill: "bills",
  debt: "debts",
  goal: "goals",
  note: "notes",
  reminder: "reminders",
};

const CATEGORIES = [
  "Mercado",
  "Casa",
  "Beleza",
  "Saúde",
  "Transporte",
  "Lazer",
  "Roupas",
  "Estudos",
  "Venda",
  "Salário",
  "Pix",
  "Outros",
];

type Row = Record<string, unknown> & { id?: string };

export function RecordSheet({
  open,
  onOpenChange,
  initialType = "income",
  record,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: RecordType;
  record?: (Row & { __type: RecordType }) | null;
}) {
  const [type, setType] = useState<RecordType>(initialType);
  const [form, setForm] = useState<Row>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = useSaveRecord(TABLE[type]);
  const remove = useDeleteRecord(TABLE[type]);
  const editing = Boolean(record?.id);

  useEffect(() => {
    if (!open) return;
    if (record) {
      setType(record.__type);
      const { __type: _ignored, ...rest } = record;
      setForm(rest);
    } else {
      setType(initialType);
      setForm({ date: todayISO(), due_date: todayISO() });
    }
  }, [open, record, initialType]);

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));
  const str = (key: string) => (form[key] === undefined || form[key] === null ? "" : String(form[key]));
  const num = (key: string) => (form[key] === undefined ? "" : String(form[key]));

  const handleSave = () => {
    const payload: Row = {};
    if (form.id) payload.id = form.id;
    const amount = Number(String(form.amount ?? "0").replace(",", ".")) || 0;

    if (type === "income" || type === "expense" || type === "fixed") {
      if (!amount) return toast.error("Informe o valor");
      Object.assign(payload, {
        kind: type,
        amount,
        description: str("description") || RECORD_TYPES.find((t) => t.key === type)?.label,
        category: str("category") || null,
        date: str("date") || todayISO(),
        paid: form.paid !== false,
        recurring: type === "fixed",
      });
    } else if (type === "bill") {
      if (!str("name")) return toast.error("Informe o nome da conta");
      Object.assign(payload, {
        name: str("name"),
        amount,
        due_date: str("due_date") || todayISO(),
        paid: form.paid === true,
        recurring: form.recurring === true,
        category: str("category") || null,
      });
    } else if (type === "debt") {
      if (!str("name")) return toast.error("Informe o nome da dívida");
      Object.assign(payload, {
        name: str("name"),
        total_amount: Number(String(form.total_amount ?? "0").replace(",", ".")) || 0,
        paid_amount: Number(String(form.paid_amount ?? "0").replace(",", ".")) || 0,
        due_date: str("due_date") || todayISO(),
        installments_total: Number(form.installments_total ?? 1) || 1,
        installments_paid: Number(form.installments_paid ?? 0) || 0,
      });
    } else if (type === "goal") {
      if (!str("name")) return toast.error("Informe o nome da meta");
      Object.assign(payload, {
        name: str("name"),
        target_amount: Number(String(form.target_amount ?? "0").replace(",", ".")) || 0,
        saved_amount: Number(String(form.saved_amount ?? "0").replace(",", ".")) || 0,
        deadline: str("deadline") || null,
      });
    } else if (type === "note") {
      Object.assign(payload, {
        title: str("title") || "Anotação",
        content: str("content"),
        date: str("date") || todayISO(),
      });
    } else {
      if (!str("title")) return toast.error("Informe o lembrete");
      Object.assign(payload, {
        title: str("title"),
        date: str("date") || todayISO(),
        done: form.done === true,
      });
    }

    save.mutate(payload, {
      onSuccess: () => {
        toast.success(editing ? "Alterações salvas" : "Registrado!");
        onOpenChange(false);
      },
      onError: (e: unknown) => toast.error((e as Error).message),
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl px-4 pb-8">
          <SheetHeader className="px-0">
            <SheetTitle className="font-display text-2xl">
              {editing ? "Editar registro" : "Novo registro"}
            </SheetTitle>
            <SheetDescription>Rápido: escolha, digite o valor e salve.</SheetDescription>
          </SheetHeader>

          {!editing && (
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {RECORD_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setType(t.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                    type === t.key
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <span>{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 space-y-4">
            {(type === "income" || type === "expense" || type === "fixed") && (
              <>
                <Field label="Valor">
                  <Input
                    inputMode="decimal"
                    autoFocus
                    placeholder="0,00"
                    className="h-14 text-2xl font-semibold"
                    value={num("amount")}
                    onChange={(e) => set("amount", e.target.value)}
                  />
                </Field>
                <Field label="Descrição">
                  <Input
                    placeholder="Ex.: Venda, aluguel, mercado"
                    value={str("description")}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </Field>
                <Field label="Categoria">
                  <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => set("category", str("category") === c ? "" : c)}
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                          str("category") === c
                            ? "border-transparent bg-accent text-accent-foreground"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Data">
                  <Input type="date" value={str("date")} onChange={(e) => set("date", e.target.value)} />
                </Field>
              </>
            )}

            {type === "bill" && (
              <>
                <Field label="Nome da conta">
                  <Input autoFocus value={str("name")} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <Field label="Valor">
                  <Input
                    inputMode="decimal"
                    className="h-14 text-2xl font-semibold"
                    value={num("amount")}
                    onChange={(e) => set("amount", e.target.value)}
                  />
                </Field>
                <Field label="Vencimento">
                  <Input
                    type="date"
                    value={str("due_date")}
                    onChange={(e) => set("due_date", e.target.value)}
                  />
                </Field>
                <ToggleRow
                  label="Já foi paga"
                  checked={form.paid === true}
                  onChange={(v) => set("paid", v)}
                />
                <ToggleRow
                  label="Repete todo mês"
                  checked={form.recurring === true}
                  onChange={(v) => set("recurring", v)}
                />
              </>
            )}

            {type === "debt" && (
              <>
                <Field label="Nome da dívida">
                  <Input autoFocus value={str("name")} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Valor total">
                    <Input
                      inputMode="decimal"
                      value={num("total_amount")}
                      onChange={(e) => set("total_amount", e.target.value)}
                    />
                  </Field>
                  <Field label="Já pago">
                    <Input
                      inputMode="decimal"
                      value={num("paid_amount")}
                      onChange={(e) => set("paid_amount", e.target.value)}
                    />
                  </Field>
                  <Field label="Parcelas">
                    <Input
                      inputMode="numeric"
                      value={num("installments_total")}
                      onChange={(e) => set("installments_total", e.target.value)}
                    />
                  </Field>
                  <Field label="Pagas">
                    <Input
                      inputMode="numeric"
                      value={num("installments_paid")}
                      onChange={(e) => set("installments_paid", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Próximo vencimento">
                  <Input
                    type="date"
                    value={str("due_date")}
                    onChange={(e) => set("due_date", e.target.value)}
                  />
                </Field>
              </>
            )}

            {type === "goal" && (
              <>
                <Field label="Nome da meta">
                  <Input autoFocus value={str("name")} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quero juntar">
                    <Input
                      inputMode="decimal"
                      value={num("target_amount")}
                      onChange={(e) => set("target_amount", e.target.value)}
                    />
                  </Field>
                  <Field label="Já guardei">
                    <Input
                      inputMode="decimal"
                      value={num("saved_amount")}
                      onChange={(e) => set("saved_amount", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Prazo (opcional)">
                  <Input
                    type="date"
                    value={str("deadline")}
                    onChange={(e) => set("deadline", e.target.value)}
                  />
                </Field>
              </>
            )}

            {type === "note" && (
              <>
                <Field label="Título">
                  <Input autoFocus value={str("title")} onChange={(e) => set("title", e.target.value)} />
                </Field>
                <Field label="Anotação">
                  <Textarea
                    rows={4}
                    value={str("content")}
                    onChange={(e) => set("content", e.target.value)}
                  />
                </Field>
                <Field label="Data">
                  <Input type="date" value={str("date")} onChange={(e) => set("date", e.target.value)} />
                </Field>
              </>
            )}

            {type === "reminder" && (
              <>
                <Field label="Lembrete">
                  <Input autoFocus value={str("title")} onChange={(e) => set("title", e.target.value)} />
                </Field>
                <Field label="Data">
                  <Input type="date" value={str("date")} onChange={(e) => set("date", e.target.value)} />
                </Field>
                <ToggleRow
                  label="Concluído"
                  checked={form.done === true}
                  onChange={(v) => set("done", v)}
                />
              </>
            )}
          </div>

          <div className="mt-6 flex gap-2">
            {editing && (
              <Button variant="outline" onClick={() => setConfirmDelete(true)} className="flex-1">
                Excluir
              </Button>
            )}
            <Button onClick={handleSave} disabled={save.isPending} className="h-12 flex-[2] text-base">
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O registro será removido para sempre.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                remove.mutate(String(form.id), {
                  onSuccess: () => {
                    toast.success("Registro excluído");
                    setConfirmDelete(false);
                    onOpenChange(false);
                  },
                })
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
