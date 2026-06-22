import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Receipt, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/despesas", label: "Despesas", icon: Receipt },
  { to: "/assinaturas", label: "Assinaturas", icon: CreditCard },
] as const;

export const Route = createFileRoute("/_authenticated/despesas")({
  component: DespesasLayout,
  head: () => ({ meta: [{ title: "Despesas — AURA Consumo" }] }),
});

function DespesasLayout() {
  const { pathname } = useLocation();
  return (
    <>
      <nav aria-label="Submenu despesas" className="mb-4">
        <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-2xl">
          {TABS.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <Outlet />
    </>
  );
}

