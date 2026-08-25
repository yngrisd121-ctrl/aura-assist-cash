import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, ClockemptyPlaceholder, Home, Plus, Sparkles } from "lucide-react";
import { RecordSheet, type RecordType } from "@/components/record-sheet";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown> & { id?: string };
type SheetCtx = { open: (type?: RecordType, record?: Row & { __type: RecordType }) => void };

const RecordSheetContext = createContext<SheetCtx>({ open: () => {} });
export const useRecordSheet = () => useContext(RecordSheetContext);

const NAV = [
  { to: "/painel", label: "Início", icon: Home },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/buscar", label: "Buscar", icon: Search },
  { to: "/mais", label: "Mais", icon: Sparkles },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [type, setType] = useState<RecordType>("income");
  const [record, setRecord] = useState<(Row & { __type: RecordType }) | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const open = useCallback((t: RecordType = "income", r?: Row & { __type: RecordType }) => {
    setType(t);
    setRecord(r ?? null);
    setSheetOpen(true);
  }, []);

  const ctx = useMemo(() => ({ open }), [open]);

  return (
    <RecordSheetContext.Provider value={ctx}>
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col bg-gradient-soft">
        <main className="flex-1 px-4 pt-5 pb-28">{children}</main>

        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-2xl border-t border-border bg-card/90 pt-1.5 backdrop-blur-md">
          <div className="grid grid-cols-5 items-end">
            {NAV.slice(0, 2).map((item) => (
              <NavItem key={item.to} {...item} active={pathname.startsWith(item.to)} />
            ))}
            <div className="flex justify-center">
              <button
                type="button"
                aria-label="Novo registro"
                onClick={() => open()}
                className="-mt-7 flex size-14 items-center justify-center rounded-full bg-gradient-rose text-primary-foreground shadow-soft active:scale-95"
              >
                <Plus className="size-7" strokeWidth={2.5} />
              </button>
            </div>
            {NAV.slice(2).map((item) => (
              <NavItem key={item.to} {...item} active={pathname.startsWith(item.to)} />
            ))}
          </div>
        </nav>
      </div>

      <RecordSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initialType={type}
        record={record}
      />
    </RecordSheetContext.Provider>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      preload="intent"
      className={cn(
        "flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className={cn("size-5", active && "fill-primary/15")} />
      {label}
    </Link>
  );
}
