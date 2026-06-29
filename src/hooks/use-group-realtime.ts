import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscrição global de realtime para sincronizar dados entre membros do
 * Grupo Familiar.
 *
 * Estratégia: como o filtro `filter=user_id=eq.<id>` é específico por usuário,
 * usamos um canal sem filtro — a própria RLS no servidor garante que cada
 * cliente só recebe eventos das linhas que pode ler (próprias + do grupo).
 *
 * Cada evento dispara `aura:data-changed`, ao qual as telas (dashboard,
 * despesas, insights, etc.) já reagem para recarregar dados.
 *
 * Montado uma única vez no layout `_authenticated/route.tsx` para evitar
 * múltiplas subscrições (custo de Realtime e dedupe de eventos).
 */
export function useGroupRealtime(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const fire = () => window.dispatchEvent(new CustomEvent("aura:data-changed"));

    const channel = supabase
      .channel("aura-shared-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, fire)
      .on("postgres_changes", { event: "*", schema: "public", table: "expense_items" }, fire)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, fire)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recurring_expenses" },
        fire,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled]);
}
