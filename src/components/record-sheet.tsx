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
import {
  useDeleteRecord,
  useEntries,
  useSaveRecord,
  useSavePercent,
  type TableName,
} from "@/lib/db";
import { brl, todayISO } from "@/lib/finance";
import { BILL_TYPES, DEBT_TYPES } from "@/lib/obligations";
import { cn } from "@/lib/utils";


export type RecordType =
  | "income"
  | "expense"
  | "saving"
  | "fixed"
  | "bill"
  | "debt"
  | "goal"
  | "note"
  | "reminder";

export const RECORD_TYPES: { key: RecordType; label: string; emoji: string }[] = [
  { key: "income", label: "Entrada", emoji: "💰" },
  { key: "expense", label: "Gasto", emoji: "💸" },
  { key: "saving", label: "Guardar", emoji: "💗" },
  { key: "debt", label: "Dívida", emoji: "💳" },
  { key: "fixed", label: "Gasto fixo", emoji: "🔁" },
  { key: "bill", label: "Conta", emoji: "🏠" },
  { key: "goal", label: "Meta", emoji: "🎯" },
  { key: "note", label: "Anotação", emoji: "📝" },
  { key: "reminder", label: "Lembrete", emoji: "🔔" },
];

const TABLE: Record<RecordType, TableName> = {
  income: "entries",
  expense: "entries",
  saving: "entries",
  fixed: "entries",
  bill: "bills",
  debt: "debts",
  goal: "goals",
  note: "notes",
  reminder: "reminders",
};

const INCOME_CATEGORIES = ["Venda", "Serviço", "Comissão", "Presente", "Salário", "Outros"];
const EXPENSE_CATEGORIES = [
  "Alimentação",
  "Moradia",
  "Contas",
  "Transporte",
  "Cartão",
  "Compras",
  "Lazer",
  "Saúde",
  "Outros",
];
const SAVING_CATEGORIES = ["Reserva de emergência", "Meta", "Investimento", "Outros"];
const METHODS = ["Pix", "Dinheiro", "Cartão", "Transferência", "Outro"];
const PERCENTS = [5, 10, 15, 20];

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
  const defaultPercent = useSavePercent();
  const [percent, setPercent] = useState(defaultPercent);
  const [autoSave, setAutoSave] = useState(false);

  const save = useSaveRecord(TABLE[type]);
  const saveEntry = useSaveRecord("entries");
  const remove = useDeleteRecord(TABLE[type]);
  const removeEntry = useDeleteRecord("entries");
  const editing = Boolean(record?.id);
  const { data: allEntries } = useEntries();

  const linkedSaving = record?.id
    ? (allEntries ?? []).find(
        (e) => e.kind === "saving" && e.source_entry_id === (record.id as string),
      )
    : undefined;

  useEffect(() => {
    if (!open) return;
    if (record) {
      setType(record.__type);
      const { __type: _ignored, ...rest } = record;
      setForm(rest);
      const savedPercent = Number(record['save_percent'] ?? 0);
      setPercent(savedPercent > 0 ? savedPercent : defaultPercent);
      setAutoSave(Boolean(linkedSaving));
    } else {
      setType(initialType);
      setPercent(defaultPercent);
      setAutoSave(false);
      setForm({ date: todayISO(), due_date: todayISO() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record, initialType, defaultPercent, linkedSaving?.id]);


  const catKind = type === "income" ? "income" : type === "saving" ? "saving" : "expense";
  const defaultCats =
    catKind === "income" ? INCOME_CATEGORIES : catKind === "saving" ? SAVING_CATEGORIES : EXPENSE_CATEGORIES;
  const customCats = (categories ?? []).filter((c) => c.kind === catKind);
  const categoryList = customCats.length ? customCats.map((c) => c.name) : defaultCats;

  const openCategoryEditor = (focusNew: boolean) => {
    if (!customCats.length) {
      seedCategories.mutate(defaultCats.map((name) => ({ name, kind: catKind })));
    }
    setNewCategory("");
    setEditorFocusNew(focusNew);
    setCategoryEditor(true);
  };

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));
  const str = (key: string) => (form[key] === undefined || form[key] === null ? "" : String(form[key]));
  const num = (key: string) => (form[key] === undefined ? "" : String(form[key]));

  const amountValue = Number(String(form['amount'] ?? "0").replace(",", ".")) || 0;
  const suggested = Math.round(amountValue * percent) / 100;
  const parcelSuggestion =
    Math.round(
      ((Number(String(form['total_amount'] ?? "0").replace(",", ".")) || 0) /
        Math.max(1, Number(form['installments_total'] ?? 1) || 1)) *
        100,
    ) / 100;

  const handleSave = () => {
    const payload: Row = {};
    if (form.id) payload.id = form.id;
    const amount = amountValue;

    if (type === "income" || type === "expense" || type === "fixed" || type === "saving") {
      if (!amount) { toast.error("Informe o valor"); return; }
      Object.assign(payload, {
        kind: type,
        amount,
        description: str("description") || RECORD_TYPES.find((t) => t.key === type)?.label,
        category: str("category") || null,
        date: str("date") || todayISO(),
        method: str("method") || null,
        client_name: str("client_name") || null,
        notes: str("notes") || null,
        paid: form['paid'] !== false,

        recurring: type === "fixed",
      });
    } else if (type === "bill") {
      if (!str("name")) { toast.error("Informe o nome da conta"); return; }
      const dueDate = str("due_date") || todayISO();
      const recurring = form['recurring'] === true;
      const day = Number(form['due_day'] ?? 0) || Number(dueDate.slice(8)) || 1;
      Object.assign(payload, {
        name: str("name"),
        amount,
        due_date: dueDate,
        due_day: Math.min(Math.max(day, 1), 31),
        active: form['active'] !== false,
        bill_type: str("bill_type") || null,
        paid: recurring ? false : form['paid'] === true,
        recurring,
        category: str("bill_type") || str("category") || null,
      });
    } else if (type === "debt") {
      if (!str("name")) { toast.error("Informe o nome da dívida"); return; }
      const total = Number(String(form['total_amount'] ?? "0").replace(",", ".")) || 0;
      const parcels = Math.max(1, Number(form['installments_total'] ?? 1) || 1);
      const perParcel =
        Number(String(form['installment_amount'] ?? "0").replace(",", ".")) ||
        Math.round((total / parcels) * 100) / 100;
      Object.assign(payload, {
        name: str("name"),
        debt_type: str("debt_type") || null,
        total_amount: total,
        paid_amount: Number(String(form['paid_amount'] ?? "0").replace(",", ".")) || 0,
        due_date: str("due_date") || todayISO(),
        installments_total: parcels,
        installments_paid: Math.min(parcels, Number(form['installments_paid'] ?? 0) || 0),
        installment_amount: perParcel,
        notes: str("notes") || null,
      });
    } else if (type === "goal") {
      if (!str("name")) { toast.error("Informe o nome da meta"); return; }
      Object.assign(payload, {
        name: str("name"),
        target_amount: Number(String(form['target_amount'] ?? "0").replace(",", ".")) || 0,
        saved_amount: Number(String(form['saved_amount'] ?? "0").replace(",", ".")) || 0,
        deadline: str("deadline") || null,
        save_amount: Number(String(form['save_amount'] ?? "0").replace(",", ".")) || 0,
        save_period: str("save_period") || "month",
      });

    } else if (type === "note") {
      Object.assign(payload, {
        title: str("title") || "Anotação",
        content: str("content"),
        date: str("date") || todayISO(),
      });
    } else {
      if (!str("title")) { toast.error("Informe o lembrete"); return; }
      Object.assign(payload, {
        title: str("title"),
        date: str("date") || todayISO(),
        done: form['done'] === true,
      });
    }

    save.mutate(payload, {
      onSuccess: () => {
        if (type === "income" && !editing && autoSave && suggested > 0) {
          saveEntry.mutate({
            kind: "saving",
            amount: suggested,
            description: `Guardei ${percent}% da entrada`,
            category: "Guardar",
            date: str("date") || todayISO(),
                paid: true,
            recurring: false,
          });
          toast.success(`Registrado! ${brl(suggested)} guardado 💗`);
        } else {
          toast.success(editing ? "Alterações salvas" : "Registrado!");
        }
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
                  onClick={() => {
                    setType(t.key);
                    setForm((f) => ({ ...f, category: "" }));
                  }}
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
            {(type === "income" || type === "expense" || type === "fixed" || type === "saving") && (
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

                {type === "income" && amountValue > 0 && (
                  <div className="rounded-2xl border border-border bg-gradient-soft p-4">
                    <p className="text-xs text-muted-foreground">
                      💗 Guardar {percent}% → <strong>{brl(suggested)}</strong> · Disponível{" "}
                      <strong>{brl(amountValue - suggested)}</strong>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PERCENTS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPercent(p)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium",
                            percent === p
                              ? "border-transparent bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground",
                          )}
                        >
                          {p}%
                        </button>
                      ))}
                      <ToggleChip
                        active={autoSave}
                        onClick={() => setAutoSave((v) => !v)}
                        label={autoSave ? "Guardando ✓" : "Guardar junto"}
                      />
                    </div>
                  </div>
                )}

                <Field label="Descrição">
                  <Input
                    placeholder="Ex.: Venda, aluguel, mercado"
                    value={str("description")}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </Field>

                <Field label="Categoria">
                  <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                    {categoryList.map((c) => (
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
                    <button
                      type="button"
                      onClick={() => openCategoryEditor(true)}
                      className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground"
                    >
                      + Nova categoria
                    </button>
                    <button
                      type="button"
                      onClick={() => openCategoryEditor(false)}
                      className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground"
                    >
                      Editar categorias
                    </button>
                  </div>
                </Field>

                <Field label="Data">
                  <Input
                    type="date"
                    value={str("date")}
                    onChange={(e) => set("date", e.target.value)}
                  />
                </Field>


                {type === "income" && (
                  <>
                    <Field label="Forma de recebimento">
                      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                        {METHODS.map((mth) => (
                          <button
                            key={mth}
                            type="button"
                            onClick={() => set("method", str("method") === mth ? "" : mth)}
                            className={cn(
                              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                              str("method") === mth
                                ? "border-transparent bg-accent text-accent-foreground"
                                : "border-border text-muted-foreground",
                            )}
                          >
                            {mth}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Cliente (opcional)">
                      <Input
                        value={str("client_name")}
                        onChange={(e) => set("client_name", e.target.value)}
                      />
                    </Field>
                    <Field label="Observação">
                      <Textarea
                        rows={2}
                        value={str("notes")}
                        onChange={(e) => set("notes", e.target.value)}
                      />
                    </Field>
                  </>
                )}
              </>
            )}


            {type === "bill" && (
              <>
                <Field label="Nome da conta">
                  <Input
                    autoFocus
                    placeholder="Ex.: Aluguel, energia, internet"
                    value={str("name")}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </Field>
                <Field label="Tipo">
                  <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                    {BILL_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => set("bill_type", str("bill_type") === t ? "" : t)}
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                          str("bill_type") === t
                            ? "border-transparent bg-accent text-accent-foreground"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Valor">
                  <Input
                    inputMode="decimal"
                    className="h-14 text-2xl font-semibold"
                    value={num("amount")}
                    onChange={(e) => set("amount", e.target.value)}
                  />
                </Field>
                <ToggleRow
                  label="Repete todo mês"
                  checked={form['recurring'] === true}
                  onChange={(v) => set("recurring", v)}
                />
                {form['recurring'] === true ? (
                  <>
                    <Field label="Dia do vencimento">
                      <Input
                        inputMode="numeric"
                        placeholder="10"
                        value={num("due_day")}
                        onChange={(e) => set("due_day", e.target.value)}
                      />
                    </Field>
                    <Field label="Começa em">
                      <Input
                        type="date"
                        value={str("due_date")}
                        onChange={(e) => set("due_date", e.target.value)}
                      />
                    </Field>
                    <ToggleRow
                      label="Conta ativa"
                      checked={form['active'] !== false}
                      onChange={(v) => set("active", v)}
                    />
                  </>
                ) : (
                  <>
                    <Field label="Vencimento">
                      <Input
                        type="date"
                        value={str("due_date")}
                        onChange={(e) => set("due_date", e.target.value)}
                      />
                    </Field>
                    <ToggleRow
                      label="Já foi paga"
                      checked={form['paid'] === true}
                      onChange={(v) => set("paid", v)}
                    />
                  </>
                )}
              </>
            )}

            {type === "debt" && (
              <>
                <Field label="Nome da dívida">
                  <Input
                    autoFocus
                    placeholder="Ex.: Cartão, empréstimo"
                    value={str("name")}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </Field>
                <Field label="Tipo">
                  <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                    {DEBT_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => set("debt_type", str("debt_type") === t ? "" : t)}
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                          str("debt_type") === t
                            ? "border-transparent bg-accent text-accent-foreground"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Valor total">
                    <Input
                      inputMode="decimal"
                      value={num("total_amount")}
                      onChange={(e) => set("total_amount", e.target.value)}
                    />
                  </Field>
                  <Field label="Parcelas">
                    <Input
                      inputMode="numeric"
                      value={num("installments_total")}
                      onChange={(e) => set("installments_total", e.target.value)}
                    />
                  </Field>
                  <Field label="Valor da parcela">
                    <Input
                      inputMode="decimal"
                      placeholder={brl(parcelSuggestion)}
                      value={num("installment_amount")}
                      onChange={(e) => set("installment_amount", e.target.value)}
                    />
                  </Field>
                  <Field label="Parcelas pagas">
                    <Input
                      inputMode="numeric"
                      value={num("installments_paid")}
                      onChange={(e) => set("installments_paid", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Já pago (R$)">
                  <Input
                    inputMode="decimal"
                    value={num("paid_amount")}
                    onChange={(e) => set("paid_amount", e.target.value)}
                  />
                </Field>
                <Field label="Vencimento da 1ª parcela">
                  <Input
                    type="date"
                    value={str("due_date")}
                    onChange={(e) => set("due_date", e.target.value)}
                  />
                </Field>
                <Field label="Observações">
                  <Textarea
                    rows={2}
                    value={str("notes")}
                    onChange={(e) => set("notes", e.target.value)}
                  />
                </Field>
                <p className="rounded-2xl bg-gradient-soft p-3 text-xs text-muted-foreground">
                  Cada parcela sugerida fica em <strong>{brl(parcelSuggestion)}</strong>. Você marca
                  como paga na tela de Contas &amp; Dívidas. 💗
                </p>
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
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quero guardar">
                    <Input
                      inputMode="decimal"
                      placeholder="0,00"
                      value={num("save_amount")}
                      onChange={(e) => set("save_amount", e.target.value)}
                    />
                  </Field>
                  <Field label="A cada">
                    <div className="flex gap-1.5">
                      {[
                        { k: "day", l: "Dia" },
                        { k: "week", l: "Semana" },
                        { k: "month", l: "Mês" },
                      ].map((p) => (
                        <button
                          key={p.k}
                          type="button"
                          onClick={() => set("save_period", p.k)}
                          className={cn(
                            "flex-1 rounded-full border px-2 py-2 text-xs font-medium",
                            (str("save_period") || "month") === p.k
                              ? "border-transparent bg-accent text-accent-foreground"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          {p.l}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>

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
                  checked={form['done'] === true}
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

function ToggleChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-gradient-rose text-primary-foreground"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}
