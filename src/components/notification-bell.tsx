import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Bell, BellRing, CreditCard, Repeat, Receipt, Apple, CheckCheck, Trash2 } from "lucide-react";
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

const TYPE_LABELS: Record<string, string> = {
  subscription_due: "Assinaturas",
  recurring_due: "Contas",
  daily_summary: "Resumo diário",
  weekly_summary: "Resumo semanal",
  health_alert: "Saúde",
};

type Filter = "all" | "unread" | string; // string = tipo específico

const LAST_CHECK_KEY = "aura:notif-last-check";
const PUSH_ENABLED_KEY = "aura:notifications-enabled";
const FILTER_KEY = "aura:notif-filter";

/** Dispara notificação nativa do navegador (in-browser push, sem servidor). */
function firePush(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (localStorage.getItem(PUSH_ENABLED_KEY) !== "1") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico", tag: "aura-notif", silent: false });
  } catch {
    // alguns navegadores exigem service worker para mostrar — falha silenciosamente
  }
}

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>(() => {
    if (typeof window === "undefined") return "all";
    return (localStorage.getItem(FILTER_KEY) as Filter) || "all";
  });
  const generate = useServerFn(generateNotifications);
  const navigate = useNavigate();
  const seenIdsRef = useRef<Set<string> | null>(null);

  // Persiste o filtro escolhido
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(FILTER_KEY, filter);
  }, [filter]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("user_notifications")
      .select("id,type,title,message,read,created_at,related_id")
      .order("created_at", { ascending: false })
      .limit(50);
    const next = (data ?? []) as Notif[];

    // Detecta novas e dispara push nativo (apenas para itens não vistos antes)
    if (seenIdsRef.current !== null) {
      const newly = next.filter((n) => !seenIdsRef.current!.has(n.id) && !n.read);
      if (newly.length === 1) firePush(newly[0].title, newly[0].message);
      else if (newly.length > 1) firePush(`${newly.length} novas notificações`, newly[0].title);
    }
    seenIdsRef.current = new Set(next.map((n) => n.id));
    setItems(next);
  }, []);

  // Mount: gera + carrega; depois recarrega a cada 5 min
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const last = Number(localStorage.getItem(LAST_CHECK_KEY) ?? 0);
        const now = Date.now();
        if (now - last > 30 * 60_000) {
          const res = await generate();
          localStorage.setItem(LAST_CHECK_KEY, String(now));
          if (active && res.created > 0) {
            toast(`${res.created} nova${res.created>1?"s":""} notificação${res.created>1?"ões":""}`, {
              description: res.items[0]?.title,
            });
          }
        }
      } catch { /* silencioso */ }
      if (active) await load();
    };
    run();
    const id = window.setInterval(load, 5 * 60_000);
    return () => { active = false; window.clearInterval(id); };
  }, [generate, load]);

  const unread = items.filter((n) => !n.read).length;

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unread") return items.filter((n) => !n.read);
    return items.filter((n) => n.type === filter);
  }, [items, filter]);

  // tipos presentes (para mostrar só chips relevantes)
  const presentTypes = useMemo(
    () => [...new Set(items.map((n) => n.type))].filter((t) => t in TYPE_LABELS),
    [items],
  );

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

  const clearAll = async () => {
    if (items.length === 0) return;
    if (!confirm("Apagar todas as notificações? Esta ação não pode ser desfeita.")) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("user_notifications")
      .delete()
      .eq("user_id", u.user.id);
    if (error) { toast.error("Falha ao limpar"); return; }
    setItems([]);
    seenIdsRef.current = new Set();
    toast.success("Notificações limpas.");
  };

  const handleClick = async (n: Notif) => {
    if (!n.read) await markOne(n.id);
    const to = ROUTES[n.type];
    setOpen(false);
    if (to) navigate({ to });
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
        className="w-80 max-h-[80vh] overflow-y-auto rounded-2xl border bg-popover p-0 shadow-lg"
      >
        <div className="sticky top-0 bg-popover z-10 border-b border-border">
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-sm font-semibold">Notificações</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                  aria-label="Marcar todas como lidas"
                >
                  <CheckCheck className="size-3.5" aria-hidden />
                  Marcar
                </button>
              )}
              {items.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-destructive font-medium hover:underline flex items-center gap-1"
                  aria-label="Limpar todas as notificações"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Limpar
                </button>
              )}
            </div>
          </div>
          {items.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-3 pb-2" role="tablist" aria-label="Filtrar notificações">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={`Todas (${items.length})`} />
              <FilterChip active={filter === "unread"} onClick={() => setFilter("unread")} label={`Não lidas (${unread})`} />
              {presentTypes.map((t) => (
                <FilterChip
                  key={t}
                  active={filter === t}
                  onClick={() => setFilter(t)}
                  label={TYPE_LABELS[t] ?? t}
                />
              ))}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {items.length === 0 ? "Nenhuma notificação ainda. Volte mais tarde." : "Nada neste filtro."}
          </p>
        ) : (
          <ul className="divide-y divide-border" role="list">
            {filtered.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
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

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
