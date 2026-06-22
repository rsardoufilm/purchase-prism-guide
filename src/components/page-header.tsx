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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Settings, User } from "lucide-react";

interface ProfileData {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  initials: string;
}

export function PageHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData>({
    displayName: "",
    email: "",
    avatarUrl: null,
    initials: "AU",
  });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) return;

      const email = user.email ?? "";
      const name = (user.user_metadata?.display_name as string | undefined) || email.split("@")[0] || "";
      const initials = name.slice(0, 2).toUpperCase() || "AU";

      const { data: p } = await supabase
        .from("profiles")
        .select("display_name,avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      let signedAvatar: string | null = null;
      if (p?.avatar_url) {
        const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(p.avatar_url, 60 * 60);
        signedAvatar = signed?.signedUrl ?? null;
      }

      setProfile({
        displayName: p?.display_name || name,
        email,
        avatarUrl: signedAvatar,
        initials,
      });
    })();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="size-10 shrink-0 rounded-full bg-muted border border-border grid place-items-center text-xs font-bold text-foreground hover:bg-primary-soft hover:text-primary transition-colors cursor-pointer"
            aria-label="Menu do perfil"
          >
            <Avatar className="size-10">
              <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.displayName || "Perfil"} />
              <AvatarFallback className="bg-transparent text-xs font-bold">{profile.initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-56 rounded-2xl border bg-popover p-2 shadow-lg">
          <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
            <Avatar className="size-10">
              <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.displayName || "Perfil"} />
              <AvatarFallback className="bg-muted text-xs font-bold">{profile.initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate">{profile.displayName || "Usuário"}</span>
              <span className="text-xs text-muted-foreground truncate">{profile.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1.5" />
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
    </header>
  );
}
