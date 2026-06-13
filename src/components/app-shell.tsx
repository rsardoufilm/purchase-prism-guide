import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Receipt,
  ShoppingBasket,
  Package,
  Sparkles,
  CreditCard,
  Repeat,
  MessageCircle,
  LogOut,
  ScanLine,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/despesas", label: "Despesas", icon: Receipt },
  { to: "/consumo", label: "Consumo", icon: ShoppingBasket },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/insights", label: "Insights", icon: Sparkles },
  { to: "/chat", label: "Pergunte", icon: MessageCircle },
  { to: "/assinaturas", label: "Assinaturas", icon: CreditCard },
  { to: "/recorrentes", label: "Recorrentes", icon: Repeat },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (to: string) => location.pathname.startsWith(to);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-28 md:pb-0 md:pl-20">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-screen w-20 flex-col items-center py-8 border-r border-border bg-card z-40">
        <div className="size-10 rounded-2xl bg-primary grid place-items-center mb-12 shadow-[var(--shadow-elevated)]">
          <span className="text-primary-foreground font-display font-bold text-base">A</span>
        </div>
        <div className="flex flex-col gap-2 flex-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "group flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl transition-colors",
                isActive(to)
                  ? "text-primary bg-primary-soft"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Icon className="size-5" strokeWidth={2} />
              <span className="text-[9px] font-medium tracking-tight">{label}</span>
            </Link>
          ))}
        </div>
        <button
          onClick={handleSignOut}
          className="mt-auto text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-muted transition-colors"
          aria-label="Sair"
        >
          <LogOut className="size-5" />
        </button>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-12">{children}</main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 w-full bg-card/85 backdrop-blur-xl border-t border-border z-50"
        style={{ overflow: "visible" }}
      >
        <div className="grid grid-cols-5 items-end px-2 pt-2 pb-6" style={{ overflow: "visible" }}>
          {[NAV[0], NAV[1]].map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-1 py-1",
                isActive(to) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={2} />
              <span className="text-[9px] font-semibold tracking-tight">{label}</span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              console.log("[PLUS_CLICK] navegando para /despesas/nova");
              navigate({ to: "/despesas/nova" });
            }}
            aria-label="Nova despesa"
            className="relative -top-6 mx-auto block bg-transparent border-0 p-0 cursor-pointer"
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          >
            <span className="size-14 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-[var(--shadow-elevated)] ring-4 ring-background">
              <ScanLine className="size-6" strokeWidth={2.2} />
            </span>
          </button>
          {[NAV[5], NAV[4]].map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-1 py-1",
                isActive(to) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={2} />
              <span className="text-[9px] font-semibold tracking-tight">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
