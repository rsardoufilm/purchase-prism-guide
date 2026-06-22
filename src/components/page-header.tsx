import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { LogOut, Settings, Bell, HelpCircle } from "lucide-react";
import { toast } from "sonner";

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
  const [helpOpen, setHelpOpen] = useState(false);

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
      toast.error("Seu navegador não suporta notificações.");
      return;
    }
    if (!checked) {
      setNotifEnabled(false);
      localStorage.setItem(NOTIF_KEY, "0");
      toast.success("Notificações desativadas.");
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm === "granted") {
      setNotifEnabled(true);
      localStorage.setItem(NOTIF_KEY, "1");
      toast.success("Notificações ativadas.");
    } else {
      setNotifEnabled(false);
      toast.error("Permissão negada nas configurações do navegador.");
    }
  };

  return (
    <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 mb-6 animate-aura-in">
      <Link to="/dashboard" aria-label="AURA Consumo" className="md:hidden">
        <BrandLogo size="sm" />
      </Link>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-widest mb-0.5">
          {eyebrow}
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold truncate">{title}</h1>
      </div>

      <TooltipProvider delayDuration={300}>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  className="size-10 shrink-0 rounded-full bg-primary-soft border border-border grid place-items-center text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label={`Menu de ${profile.displayName || "perfil"}`}
                >
                  {profile.initials}
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {profile.displayName || "Perfil"}
            </TooltipContent>
          </Tooltip>

          <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-2xl border bg-popover p-2 shadow-lg">
            <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
              <div className="size-10 shrink-0 rounded-full bg-primary-soft grid place-items-center text-xs font-bold text-primary">
                {profile.initials}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold truncate">{profile.displayName || "Usuário"}</span>
                <span className="text-xs text-muted-foreground truncate">{profile.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1.5" />

            <div className="flex items-center justify-between rounded-xl px-2 py-2 gap-2 text-sm hover:bg-accent">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="size-4 text-muted-foreground shrink-0" />
                <span className="truncate">Notificações</span>
              </div>
              <Switch
                checked={notifEnabled}
                onCheckedChange={handleToggleNotifications}
                aria-label="Ativar notificações"
              />
            </div>

            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setHelpOpen(true);
              }}
              className="rounded-xl cursor-pointer px-2 py-2 gap-2 text-sm focus:bg-accent focus:text-accent-foreground"
            >
              <HelpCircle className="size-4 text-muted-foreground" />
              Ajuda rápida
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="rounded-xl cursor-pointer px-2 py-2 gap-2 text-sm focus:bg-accent focus:text-accent-foreground">
              <Link to="/configuracoes">
                <Settings className="size-4 text-muted-foreground" />
                Configurações
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="rounded-xl cursor-pointer px-2 py-2 gap-2 text-sm text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOut className="size-4" />
              Sair da conta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Ajuda rápida</DialogTitle>
            <DialogDescription>
              Atalhos e dicas para tirar o melhor do AURA Consumo.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="mt-0.5 size-6 shrink-0 rounded-full bg-primary-soft text-primary grid place-items-center text-xs font-bold">1</span>
              <span><strong>Nova despesa:</strong> toque no botão central (escaneie ou digite).</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 size-6 shrink-0 rounded-full bg-primary-soft text-primary grid place-items-center text-xs font-bold">2</span>
              <span><strong>Consumo:</strong> veja o que você consome e tendências de produtos.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 size-6 shrink-0 rounded-full bg-primary-soft text-primary grid place-items-center text-xs font-bold">3</span>
              <span><strong>Pergunte:</strong> use o chat para análises automáticas dos seus gastos.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 size-6 shrink-0 rounded-full bg-primary-soft text-primary grid place-items-center text-xs font-bold">4</span>
              <span><strong>Recorrentes &amp; Assinaturas:</strong> controle o que se repete todo mês.</span>
            </li>
          </ul>
          <p className="text-xs text-muted-foreground pt-2">
            Precisa de mais? Vá em <Link to="/configuracoes" className="text-primary underline" onClick={() => setHelpOpen(false)}>Configurações</Link>.
          </p>
        </DialogContent>
      </Dialog>
    </header>
  );
}
