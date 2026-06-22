import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

export function PageHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  const [initials, setInitials] = useState("AU");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? "";
      const name =
        (data.user?.user_metadata?.display_name as string | undefined) ||
        email.split("@")[0] ||
        "";
      const i = name.slice(0, 2).toUpperCase() || "AU";
      setInitials(i);
    });
  }, []);
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
      <Link
        to="/configuracoes"
        className="size-10 shrink-0 rounded-full bg-muted border border-border grid place-items-center text-xs font-bold text-foreground hover:bg-primary-soft hover:text-primary transition-colors"
        aria-label="Ajustes"
      >
        {initials}
      </Link>
    </header>
  );
}
