import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { NotificationBell } from "@/components/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { LogOut, Settings, Bell, HelpCircle, CircleHelp } from "lucide-react";
import { toast } from "sonner";
import { replayTour } from "@/components/tour-guide";

interface ProfileData {
  displayName: string;
  email: string;
  initials: string;
}

const NOTIF_KEY = "aura:notifications-enabled";

export function PageHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData>({
    displayName: "",
    email: "",
    initials: "AU",
  });
  const [notifEnabled, setNotifEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) return;

      const email = user.email ?? "";
      const metaName = (user.user_metadata?.display_name as string | undefined) || "";

      const { data: p } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      const displayName = p?.display_name || metaName || email.split("@")[0] || "Usuário";
      const initials =
        displayName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((n) => n[0])
          .join("")
          .toUpperCase() || "AU";

      setProfile({ displayName, email, initials });
    })();

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(NOTIF_KEY) === "1";
      const granted = typeof Notification !== "undefined" && Notification.permission === "granted";
      setNotifEnabled(stored && granted);
    }
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const handleToggleNotifications = async (checked: boolean) => {
    if (typeof Notification === "undefined") {
      toast.error("Seu navegador não suporta notificações de sistema.");
      return;
    }
    if (!checked) {
      setNotifEnabled(false);
      localStorage.setItem(NOTIF_KEY, "0");
      toast.success("Avisos desativados. Você ainda verá o sino dentro do app.");
      return;
    }
    let perm = Notification.permission;
    if (perm === "denied") {
      toast.error("Permissão bloqueada. Habilite nas configurações do navegador.", {
        description: "Toque no cadeado/ícone ao lado do endereço para liberar notificações.",
      });
      return;
    }
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm === "granted") {
      setNotifEnabled(true);
      localStorage.setItem(NOTIF_KEY, "1");
      toast.success("Avisos ativados!", {
        description: "Você receberá lembretes de assinaturas, contas e resumos de gastos.",
      });
      try {
        new Notification("AURA Consumo", { body: "Notificações ativadas com sucesso." });
      } catch {
        /* iOS pode bloquear isto fora de PWA */
      }
    } else {
      setNotifEnabled(false);
      toast.error("Permissão negada pelo navegador.");
    }
  };

  return (
    <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3 mb-3 sm:mb-5 animate-aura-in">
      <Link to="/dashboard" aria-label="AURA Consumo — início" className="md:hidden shrink-0">
        <BrandLogo size="sm" />
      </Link>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest mb-0.5">
          {eyebrow}
        </p>
        <h1 className="font-display text-xl sm:text-3xl font-bold truncate leading-tight">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 justify-self-end">
        <NotificationBell />

        <TooltipProvider delayDuration={300}>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    className="size-10 shrink-0 rounded-full bg-primary-soft border border-border grid place-items-center text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label={`Menu do perfil de ${profile.displayName || "usuário"}`}
                    aria-haspopup="menu"
                  >
                    {profile.initials}
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {profile.displayName || "Perfil"}
              </TooltipContent>
            </Tooltip>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-64 rounded-2xl border bg-popover p-2 shadow-lg"
            >
              <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
                <div
                  className="size-10 shrink-0 rounded-full bg-primary-soft grid place-items-center text-xs font-bold text-primary"
                  aria-hidden
                >
                  {profile.initials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold truncate">
                    {profile.displayName || "Usuário"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">{profile.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1.5" />

              <div className="rounded-xl px-2 py-2 hover:bg-accent">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <label
                    htmlFor="notif-switch"
                    className="flex items-center gap-2 min-w-0 cursor-pointer"
                  >
                    <Bell className="size-4 text-muted-foreground shrink-0" aria-hidden />
                    <span className="truncate">Avisos do sistema</span>
                  </label>
                  <Switch
                    id="notif-switch"
                    checked={notifEnabled}
                    onCheckedChange={handleToggleNotifications}
                    aria-label="Ativar avisos do navegador"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 ml-6 leading-snug">
                  Lembretes mesmo com app em segundo plano.
                </p>
              </div>

              <DropdownMenuItem
                asChild
                className="rounded-xl cursor-pointer px-2 py-2 gap-2 text-sm focus:bg-accent focus:text-accent-foreground"
              >
                <Link to="/ajuda">
                  <HelpCircle className="size-4 text-muted-foreground" aria-hidden />
                  Central de ajuda
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem
                asChild
                className="rounded-xl cursor-pointer px-2 py-2 gap-2 text-sm focus:bg-accent focus:text-accent-foreground"
              >
                <Link to="/configuracoes">
                  <Settings className="size-4 text-muted-foreground" aria-hidden />
                  Configurações
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1.5" />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="rounded-xl cursor-pointer px-2 py-2 gap-2 text-sm text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <LogOut className="size-4" aria-hidden />
                Sair da conta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </div>
    </header>
  );
}
