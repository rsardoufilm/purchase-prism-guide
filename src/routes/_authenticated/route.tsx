import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useGroupRealtime } from "@/hooks/use-group-realtime";
import { useCurrentGroup } from "@/hooks/use-current-group";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  // Mantém subscrição realtime ativa enquanto autenticado (apenas com grupo).
  const { isInGroup } = useCurrentGroup();
  useGroupRealtime(isInGroup);
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
