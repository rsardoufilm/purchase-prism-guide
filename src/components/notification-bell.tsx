import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Bell, BellRing, CreditCard, Repeat, Receipt, Apple, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateNotifications } from "@/lib/notifications.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  related_id: string | null;
}

const ICONS: Record<string, typeof Bell> = {
  subscription_due: CreditCard,
  recurring_due: Repeat,
  daily_summary: Receipt,
  weekly_summary: Receipt,
  health_alert: Apple,
};

type AppRoute = "/assinaturas" | "/recorrentes" | "/dashboard" | "/consumo";

const ROUTES: Record<string, AppRoute> = {
  subscription_due: "/assinaturas",
  recurring_due: "/recorrentes",
  daily_summary: "/dashboard",
  weekly_summary: "/dashboard",
  health_alert: "/consumo",
};

const LAST_CHECK_KEY = "aura:notif-last-check";

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const generate = useServerFn(generateNotifications);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("user_notifications")
      .select("id,type,title,message,read,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as Notif[]);
  }, []);

  // Gera e carrega no mount + a cada 5 minutos
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const last = Number(localStorage.getItem(LAST_CHECK_KEY) ?? 0);
        const now = Date.now();
        // só roda a geração no máximo a cada 30 min
        if (now - last > 30 * 60_000) {
          const res = await generate();
          localStorage.setItem(LAST_CHECK_KEY, String(now));
          if (active && res.created > 0) {
            toast(`${res.created} nova${res.created>1?"s":""} notificação${res.created>1?"ões":""}`, {
              description: res.items[0]?.title,
            });
          }
        }
      } catch {
        // silencioso — não bloqueia o app
      }
      if (active) await load();
    };
    run();
    const id = window.setInterval(load, 5 * 60_000);
    return () => { active = false; window.clearInterval(id); };
  }, [generate, load]);

  const unread = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("user_notifications").update({ read: true }).in("id", ids);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markOne = async (id: string) => {
    await supabase.from("user_notifications").update({ read: true }).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative size-10 shrink-0 rounded-full bg-card border border-border grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={unread > 0 ? `Notificações: ${unread} não lidas` : "Notificações"}
          aria-haspopup="menu"
        >
          {unread > 0 ? <BellRing className="size-5" aria-hidden /> : <Bell className="size-5" aria-hidden />}
          {unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center border-2 border-background"
              aria-hidden
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {unread > 0 ? `${unread} notificações não lidas` : "Sem notificações novas"}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 max-h-[70vh] overflow-y-auto rounded-2xl border bg-popover p-0 shadow-lg"
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border sticky top-0 bg-popover z-10">
          <span className="text-sm font-semibold">Notificações</span>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
              aria-label="Marcar todas como lidas"
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Marcar todas
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhuma notificação ainda. Volte mais tarde.
          </p>
        ) : (
          <ul className="divide-y divide-border" role="list">
            {items.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => markOne(n.id)}
                    className={cn(
                      "w-full text-left flex gap-3 px-3 py-3 hover:bg-accent transition-colors",
                      !n.read && "bg-primary-soft/30",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 size-8 shrink-0 rounded-full grid place-items-center",
                        !n.read ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
                      )}
                      aria-hidden
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {n.title}
                        {!n.read && (
                          <span className="ml-1.5 inline-block size-2 rounded-full bg-primary align-middle" aria-label="Não lida" />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
