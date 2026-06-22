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
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import logoAlpha from "@/assets/logo-alpha.png";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/despesas", label: "Despesas", icon: Receipt },
  { to: "/consumo", label: "Consumo", icon: ShoppingBasket },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/insights", label: "Insights", icon: Sparkles },
  { to: "/chat", label: "Pergunte", icon: MessageCircle },
  { to: "/assinaturas", label: "Assinaturas", icon: CreditCard },
  { to: "/recorrentes", label: "Recorrentes", icon: Repeat },
  { to: "/configuracoes", label: "Ajustes", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (to: string) => location.pathname.startsWith(to);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const handleNewExpenseTouch = () => {
    console.log("[PLUS_TOUCH] toque recebido no botão +");
    toast.message("Abrindo nova despesa…");
  };

  const handleNewExpenseClick = () => {
    console.log("[PLUS_CLICK] navegando para /despesas/nova");
    window.setTimeout(() => {
      if (window.location.pathname !== "/despesas/nova") {
        console.warn("[PLUS_FALLBACK] navegação por Link não completou, usando fallback");
        navigate({ to: "/despesas/nova" });
      }
    }, 350);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-28 md:pb-0 md:pl-20">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-screen w-20 flex-col items-center py-8 border-r border-border bg-card z-40">
        <div className="relative mb-12">
          <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 dark:from-primary/40 dark:to-primary/15 blur-[3px]" />
          <div className="relative rounded-2xl bg-card/90 dark:bg-card/70 ring-1 ring-primary/20 dark:ring-primary/40 p-2 shadow-sm dark:shadow-[0_0_24px_hsla(24,95%,58%,0.28)]">
            <img src={logoAlpha} alt="AURA Consumo" width={40} height={40} className="size-10" />
          </div>
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
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-card/85 backdrop-blur-xl border-t border-border z-50">
        <div className="grid grid-cols-5 items-center px-2 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
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
          <Link
            to="/despesas/nova"
            onPointerDown={handleNewExpenseTouch}
            onClick={handleNewExpenseClick}
            aria-label="Nova despesa"
            className="mx-auto grid size-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-[var(--shadow-elevated)] ring-4 ring-background border-0 p-0 cursor-pointer transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          >
            <ScanLine className="size-6" strokeWidth={2.2} />
          </Link>
          {[NAV[5], NAV[8]].map(({ to, label, icon: Icon }) => (
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
