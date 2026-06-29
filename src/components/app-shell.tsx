import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Receipt,
  ShoppingBasket,
  Package,
  Sparkles,
  CreditCard,
  Repeat,
  LogOut,
  ScanLine,
  Settings,
  MoreHorizontal,
  HelpCircle,
  GitMerge,
} from "lucide-react";
import { useContinuousScan } from "@/hooks/use-continuous-scan";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/despesas", label: "Despesas", icon: Receipt },
  { to: "/consumo", label: "Consumo", icon: ShoppingBasket },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/insights", label: "Insights", icon: Sparkles },
  { to: "/assinaturas", label: "Assinaturas", icon: CreditCard },
  { to: "/recorrentes", label: "Recorrentes", icon: Repeat },
  { to: "/excecoes", label: "Exceções", icon: GitMerge },
  { to: "/configuracoes", label: "Ajustes", icon: Settings },
  { to: "/ajuda", label: "Ajuda", icon: HelpCircle },
] as const;

const MOBILE_MORE = NAV.filter((n) => !["/dashboard", "/despesas"].includes(n.to));


export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  useContinuousScan();

  const isActive = (to: string) => location.pathname.startsWith(to);
  const moreActive = MOBILE_MORE.some((n) => isActive(n.to));

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
        navigate({ to: "/despesas/nova", search: { id: undefined } });
      }
    }, 350);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-28 md:pb-0 md:pl-20 overflow-x-hidden">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-screen w-20 flex-col items-center py-8 border-r border-border bg-card z-40">
        <BrandLogo size="md" className="mb-12" />
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

      <PullToRefresh>
        <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-3 sm:pt-5 pb-10">{children}</main>
      </PullToRefresh>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 w-full bg-card/90 backdrop-blur-xl border-t border-border z-50"
        aria-label="Navegação principal"
      >
        <div className="grid grid-cols-5 items-end px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          {[NAV[0], NAV[1]].map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2 min-h-12 rounded-xl transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute -top-0.5 h-1 w-8 rounded-full bg-primary" aria-hidden />
                )}
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-semibold tracking-tight">{label}</span>
              </Link>
            );
          })}
          <Link
            to="/despesas/nova"
            search={{ id: undefined }}
            onPointerDown={handleNewExpenseTouch}
            onClick={handleNewExpenseClick}
            aria-label="Nova despesa"
            className="mx-auto -mt-6 grid size-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-[var(--shadow-elevated)] ring-4 ring-background border-0 p-0 cursor-pointer transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          >
            <ScanLine className="size-6" strokeWidth={2.2} />
          </Link>
          {(() => {
            const { to, label, icon: Icon } = NAV[4]; // Insights
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2 min-h-12 rounded-xl transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute -top-0.5 h-1 w-8 rounded-full bg-primary" aria-hidden />
                )}
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-semibold tracking-tight">{label}</span>
              </Link>
            );
          })()}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Mais opções"
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2 min-h-12 rounded-xl transition-colors",
                  moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {moreActive && (
                  <span className="absolute -top-0.5 h-1 w-8 rounded-full bg-primary" aria-hidden />
                )}
                <MoreHorizontal className="size-5" strokeWidth={moreActive ? 2.4 : 2} />
                <span className="text-[10px] font-semibold tracking-tight">Mais</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Navegar</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-3 pt-4 pb-2">
                {MOBILE_MORE.map(({ to, label, icon: Icon }) => {
                  const active = isActive(to);
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card transition-colors",
                        active ? "text-primary border-primary/40 bg-primary-soft" : "text-foreground hover:bg-muted",
                      )}
                    >
                      <Icon className="size-6" strokeWidth={2} />
                      <span className="text-xs font-medium tracking-tight">{label}</span>
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    void handleSignOut();
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <LogOut className="size-6" strokeWidth={2} />
                  <span className="text-xs font-medium tracking-tight">Sair</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>

        </div>
      </nav>
    </div>
  );
}
