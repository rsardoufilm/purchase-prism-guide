import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

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
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-6 animate-aura-in">
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-widest mb-0.5">
          {eyebrow}
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold truncate">{title}</h1>
      </div>
      <Link
        to="/dashboard"
        className="size-10 shrink-0 rounded-full bg-muted border border-border grid place-items-center text-xs font-bold text-foreground"
        aria-label="Perfil"
      >
        {initials}
      </Link>
    </header>
  );
}
